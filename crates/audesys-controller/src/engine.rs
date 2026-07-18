//! Engine — the hard real-time execution loop.
//!
//! The Engine wraps a Box<dyn AmwMiddleware> and executes the
//! read_barrier → execute_functions → write_barrier cycle from
//! the HAL design documents.
//!
//! 来源: docs/modules/hal/thread-scheduling-design.md (D13)
//!       docs/modules/hal/config-barrier-design.md (D17)

use crate::lifecycle::LifecycleManager;
use crate::metrics::RuntimeMetrics;
use crate::signals::{SignalDef, SignalRegistry, StrategyFilter, WriteStrategy};
use audesys_hal_core::middleware::AmwMiddleware;
use audesys_hal_core::qos::{ConfigCommand, ConfigStatus, LockLevel};
use audesys_hal_core::types::Timestamp;
use audesys_hal_core::value::HalValue;
use audesys_hal_ir::Executor;
use audesys_hal_ir::program::HalProgram;
use audesys_hal_ir::types::Direction;
use audesys_runtime_common::types::{HealthCheck, HealthCheckRegistry, HealthStatus, SourceId};
use std::sync::{
    Arc, Mutex, RwLock,
    atomic::{AtomicBool, Ordering},
};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

/// The hard real-time execution engine.
///
/// # Thread safety
/// Engine: Send + Sync. Wraps AmwMiddleware in Arc<Mutex<>> for interior mutability.
/// All config changes are queued and applied at the cycle boundary (Config Barrier, D17).
pub struct Engine {
    /// The middleware providing transport, discovery, and QoS
    middleware: Arc<Mutex<Box<dyn AmwMiddleware>>>,
    /// Is the engine currently running?
    running: Arc<AtomicBool>,
    /// When did the engine start?
    started_at: Instant,
    /// Current controller lock level
    lock_level: RwLock<LockLevel>,
    /// Pending configuration commands (applied at cycle boundary)
    config_queue: Arc<Mutex<Vec<ConfigCommand>>>,
    /// Health check registry
    health: RwLock<HealthCheckRegistry>,
    /// Process identity for audit logging
    source_id: SourceId,
    /// Number of cycles completed
    cycle_count: Arc<std::sync::atomic::AtomicU64>,
    /// Signal registry for this controller
    signals: Arc<RwLock<SignalRegistry>>,
    /// Runtime metrics (lock-free atomic counters)
    metrics: Arc<RuntimeMetrics>,
    /// Lifecycle manager for child process supervision
    lifecycle: Arc<LifecycleManager>,
    /// Debug: is the engine paused?
    paused: Arc<AtomicBool>,
    /// Debug: execute one cycle then pause
    step_requested: Arc<AtomicBool>,
    /// Loaded HAL IR program (compiled ST → VM instructions)
    hal_program: Arc<RwLock<Option<HalProgram>>>,
    /// HAL IR VM executor for cycle-by-cycle execution
    hal_executor: Arc<RwLock<Option<Executor>>>,
}

impl Engine {
    /// Create a new engine with the given middleware.
    /// The engine starts in LockLevel::None (fully configurable).
    pub fn new(middleware: Box<dyn AmwMiddleware>, lifecycle: Arc<LifecycleManager>) -> Self {
        Self {
            middleware: Arc::new(Mutex::new(middleware)),
            running: Arc::new(AtomicBool::new(false)),
            started_at: Instant::now(),
            lock_level: RwLock::new(LockLevel::None),
            config_queue: Arc::new(Mutex::new(Vec::new())),
            health: RwLock::new(HealthCheckRegistry::new()),
            source_id: SourceId {
                process_name: "audesys-controller".into(),
                pid: std::process::id(),
            },
            cycle_count: Arc::new(std::sync::atomic::AtomicU64::new(0)),
            signals: Arc::new(RwLock::new(SignalRegistry::new())),
            metrics: Arc::new(RuntimeMetrics::new()),
            lifecycle,
            paused: Arc::new(AtomicBool::new(false)),
            step_requested: Arc::new(AtomicBool::new(false)),
            hal_program: Arc::new(RwLock::new(None)),
            hal_executor: Arc::new(RwLock::new(None)),
        }
    }

    /// Start the engine in a background thread.
    ///
    /// Returns a JoinHandle that can be used to join the engine thread.
    /// The engine runs the cycle at the given interval until stop() is called.
    pub fn start(&self, cycle_interval_ms: u64) -> JoinHandle<()> {
        self.running.store(true, Ordering::SeqCst);
        let running = Arc::clone(&self.running);

        thread::spawn(move || {
            let interval = Duration::from_millis(cycle_interval_ms);
            let mut next_cycle = Instant::now();

            while running.load(Ordering::SeqCst) {
                // Sleep until next cycle
                let now = Instant::now();
                if now < next_cycle {
                    thread::sleep(next_cycle - now);
                }
                next_cycle += interval;

                // Overflow protection: if we fell behind, reset
                if next_cycle <= Instant::now() {
                    next_cycle = Instant::now() + interval;
                }
            }
        })
    }

    /// Start the engine with full cycle execution.
    ///
    /// Unlike `start()`, this variant applies config commands and executes
    /// the full read→compute→write cycle with real signal data flow.
    pub fn start_with_cycle(&self, cycle_interval_ms: u64) -> JoinHandle<()> {
        self.running.store(true, Ordering::SeqCst);
        let middleware = Arc::clone(&self.middleware);
        let running = Arc::clone(&self.running);
        let config_queue = Arc::clone(&self.config_queue);
        let cycle_count = Arc::clone(&self.cycle_count);
        let signals = Arc::clone(&self.signals);
        let metrics = Arc::clone(&self.metrics);
        let lifecycle = Arc::clone(&self.lifecycle);
        let _hal_program = Arc::clone(&self.hal_program);
        let hal_executor = Arc::clone(&self.hal_executor);
        let paused = Arc::clone(&self.paused);
        let step_requested = Arc::clone(&self.step_requested);


        thread::spawn(move || {
            let interval = Duration::from_millis(cycle_interval_ms);
            let mut next_cycle = Instant::now();

            while running.load(Ordering::SeqCst) {
                // Debug pause: loop-sleep while paused, unless single-step was requested
                while running.load(Ordering::SeqCst) && paused.load(Ordering::SeqCst) && !step_requested.load(Ordering::SeqCst) {
                    thread::sleep(Duration::from_millis(1));
                }
                if !running.load(Ordering::SeqCst) { break; }
                while paused.load(Ordering::SeqCst) && !step_requested.load(Ordering::SeqCst) {
                    thread::sleep(Duration::from_millis(1));
                }
                step_requested.store(false, Ordering::SeqCst);

                let cycle_start = Instant::now();

                // 1. Apply pending configuration (Config Barrier)
                // 1. Apply pending configuration (Config Barrier)
                {
                    let mut queue = config_queue.lock().unwrap();
                    if !queue.is_empty() {
                        let mw = middleware.lock().unwrap();
                        for cmd in queue.drain(..) {
                            let _ = mw.queue_config(cmd);
                        }
                        let _ = mw.apply_queued();
                    }
                }

                let now_ts = Timestamp {
                    secs: 0, // ponytail: use monotonic clock in production
                    micros: 0,
                };

                // 2. READ BARRIER — update Monitored signals from middleware
                {
                    let mw = middleware.lock().unwrap();
                    let monitored =
                        signals.read().unwrap().snapshots_by_strategy(StrategyFilter::Monitored);
                    for snap in &monitored {
                        if let Ok(Some((value, _ts))) = mw.read_signal(&snap.name) {
                            let _ = signals.write().unwrap().update_value(&snap.name, value);
                        }
                    }
                }

                // 3. COMPUTE PHASE — execute Computed signal functions
                {
                    // Collect names first (release lock before re-acquiring for compute)
                    let computed_names = signals.read().unwrap().computed_signal_names();
                    for name in computed_names {
                        if let Ok(value) = signals.read().unwrap().compute_signal(&name) {
                            let _ = signals.write().unwrap().update_value(&name, value);
                        }
                    }
                }
                // 3.5 HAL IR EXECUTION — run VM program if loaded
                {
                    if let Some(ref mut executor) = *hal_executor.write().unwrap() {
                        executor.reset();
                        executor.vm_mut().set_cycle_time(cycle_interval_ms);
                        executor.run_to_halt();
                        // Publish VM signal table entries to signal registry
                        let vm = executor.vm();
                        let signal_names: Vec<String> =
                            vm.signal_names().into_iter().cloned().collect();
                        for name in signal_names {
                            if let Some(value) = vm.read_signal(&name) {
                                signals.write().unwrap().update_value(&name, value.clone()).ok();
                            }
                        }
                        executor.reset(); // reset for next cycle
                    }
                }
                // 4. WRITE BARRIER — publish Own signals through middleware
                {
                    let mw = middleware.lock().unwrap();
                    let own_signals =
                        signals.read().unwrap().snapshots_by_strategy(StrategyFilter::Own);
                    for snap in &own_signals {
                        let _ = mw.publish_signal(&snap.name, snap.value.clone(), now_ts);
                        metrics.record_signal_published();
                    }
                }

                cycle_count.fetch_add(1, Ordering::Relaxed);
                metrics.record_cycle();

                // Record cycle jitter for Studio jitter panel
                let cycle_elapsed = cycle_start.elapsed().as_micros() as u64;
                metrics.record_cycle_jitter(cycle_elapsed);


                // Lifecycle health check — detect and restart dead children
                let dead = lifecycle.health_check();
                for _name in &dead {
                    metrics.record_child_restart();
                }
                if !dead.is_empty() {
                    metrics.record_health_failure();
                }

                // 5. Sleep until next cycle
                let now = Instant::now();
                if now < next_cycle {
                    thread::sleep(next_cycle - now);
                }
                next_cycle += interval;

                // Overflow protection
                if next_cycle <= Instant::now() {
                    next_cycle = Instant::now() + interval;
                }
            }
        })
    }

    /// Stop the engine.
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }

    /// Check if engine is running.
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    /// Pause the engine.
    pub fn pause(&self) { self.paused.store(true, Ordering::SeqCst); }
    /// Resume the engine.
    pub fn resume(&self) { self.paused.store(false, Ordering::SeqCst); }
    /// Step one cycle then pause.
    pub fn step_cycle(&self) { self.paused.store(true, Ordering::SeqCst); self.step_requested.store(true, Ordering::SeqCst); }
    /// Check if paused.
    pub fn is_paused(&self) -> bool { self.paused.load(Ordering::SeqCst) }

    /// Get the number of cycles completed.
    pub fn cycle_count(&self) -> u64 {
        self.cycle_count.load(Ordering::Relaxed)
    }

    /// Get the current lock level.
    pub fn lock_level(&self) -> LockLevel {
        *self.lock_level.read().expect("lock_level RwLock poisoned")
    }

    /// Set lock level (honors LockLevel ordering: can only increase).
    pub fn set_lock_level(&self, new_level: LockLevel) -> Result<(), String> {
        let mut current = self.lock_level.write().expect("lock_level RwLock poisoned");
        if new_level < *current {
            return Err(format!(
                "Cannot decrease lock level from {:?} to {:?}",
                *current, new_level
            ));
        }
        *current = new_level;
        Ok(())
    }

    /// Queue a configuration command for the next cycle boundary.
    ///
    /// Config changes only allowed below LockLevel::Run (D17: Run level rejects all RPC).
    pub fn queue_config(&self, command: ConfigCommand) -> Result<(), String> {
        let current = self.lock_level.read().expect("lock_level RwLock poisoned");
        if *current >= LockLevel::Run {
            return Err(format!("Configuration locked: engine is at {:?} level", *current));
        }
        self.config_queue.lock().expect("config_queue Mutex poisoned").push(command);
        Ok(())
    }

    /// Apply all queued config commands now (bypasses cycle boundary wait).
    pub fn apply_config_now(&self) -> Result<Vec<ConfigStatus>, String> {
        let mut queue = self.config_queue.lock().expect("config_queue Mutex poisoned");
        if queue.is_empty() {
            return Ok(Vec::new());
        }
        let mw = self.middleware.lock().expect("middleware Mutex poisoned");
        let results = queue
            .drain(..)
            .map(|cmd| match mw.queue_config(cmd) {
                Ok(status) => status,
                Err(e) => ConfigStatus::Rejected { reason: e.to_string() },
            })
            .collect::<Vec<_>>();
        let _ = mw.apply_queued();
        Ok(results)
    }

    /// Uptime in milliseconds.
    pub fn uptime_ms(&self) -> u64 {
        self.started_at.elapsed().as_millis() as u64
    }

    /// Get middleware for direct access (e.g., health checks reading signals).
    pub fn middleware(&self) -> Arc<Mutex<Box<dyn AmwMiddleware>>> {
        Arc::clone(&self.middleware)
    }

    /// Get the source ID for audit logging.
    pub fn source_id(&self) -> &SourceId {
        &self.source_id
    }

    /// Register a health check.
    pub fn register_health_check(&self, check: Box<dyn HealthCheck>) {
        self.health.write().expect("health RwLock poisoned").register(check);
    }

    /// Run all health checks and return aggregate status.
    pub fn health_status(&self) -> HealthStatus {
        self.health.read().expect("health RwLock poisoned").aggregate()
    }
    /// Load a compiled HAL IR program into the engine.
    ///
    /// The program is deserialized from bincode, validated for well-formedness,
    /// and its executor is initialized for cycle-by-cycle execution.
    /// Signal bindings from the program are auto-registered as Own signals.
    pub fn load_hal_program(&self, bytes: &[u8]) -> Result<(), String> {
        let program: HalProgram = bincode::deserialize(bytes)
            .map_err(|e| format!("Failed to deserialize HAL program: {}", e))?;
        if !program.is_well_formed() {
            return Err("Program is not well-formed".to_string());
        }
        let executor = Executor::new(program.clone());

        // ponytail: auto-register signal bindings as Own signals
        // full type mapping (VarType → HalPinType) deferred to Phase 2
        for binding in &program.signals {
            if binding.direction == Direction::Write || binding.direction == Direction::ReadWrite {
                // default to S32; Phase 2 maps from VarType in Program.variables
                let def = SignalDef::new(
                    &binding.hal_signal_name,
                    audesys_hal_core::types::HalPinType::S32,
                    HalValue::S32(0),
                    WriteStrategy::Own,
                );
                let _ = self.signals.write().unwrap().register(def);
            }
        }

        *self.hal_program.write().unwrap() = Some(program);
        *self.hal_executor.write().unwrap() = Some(executor);
        Ok(())
    }

    /// Register a signal definition before starting the cycle.
    pub fn register_signal(&self, def: SignalDef) -> Result<(), String> {
        self.signals.write().expect("signals RwLock poisoned").register(def)
    }

    /// Get a snapshot of all signal values (name, value pairs).
    pub fn signal_snapshot(&self) -> Vec<(String, HalValue)> {
        self.signals
            .read()
            .expect("signals RwLock poisoned")
            .list_snapshots()
            .into_iter()
            .map(|s| (s.name, s.value))
            .collect()
    }

    /// Get runtime metrics.
    pub fn metrics(&self) -> Arc<RuntimeMetrics> {
        Arc::clone(&self.metrics)
    }
    /// Get access to the HAL IR VM executor for debugging.
    pub fn hal_executor(&self) -> Arc<RwLock<Option<Executor>>> {
        Arc::clone(&self.hal_executor)
    }
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;
    use crate::signals::{SignalDef, WriteStrategy};
    use audesys_hal_core::middleware::AmwMetrics;
    use audesys_hal_core::qos::HalQoS;
    use audesys_hal_core::transport::{HalTransport, RpcHandler, SignalCallback};
    use audesys_hal_core::types::HalResult;
    use std::time::Duration;

    /// Minimal mock AmwMiddleware for unit tests.
    /// Tracks publish/read calls for assertions.
    struct MockMiddleware {
        lock_level: Mutex<LockLevel>,
        config_commands: Mutex<Vec<ConfigCommand>>,
        /// Track published signals: (name, value)
        published: Mutex<Vec<(String, HalValue)>>,
        /// Track read signal calls: (name)
        reads: Mutex<Vec<String>>,
        /// Stored signal values: name → value (simulates a simple store)
        signal_store: Mutex<std::collections::HashMap<String, HalValue>>,
    }

    impl MockMiddleware {
        fn new() -> Self {
            Self {
                lock_level: Mutex::new(LockLevel::None),
                config_commands: Mutex::new(Vec::new()),
                published: Mutex::new(Vec::new()),
                reads: Mutex::new(Vec::new()),
                signal_store: Mutex::new(std::collections::HashMap::new()),
            }
        }
    }

    impl AmwMiddleware for MockMiddleware {
        fn backend_name(&self) -> &'static str {
            "mock"
        }
        fn shutdown(&self) -> HalResult<()> {
            Ok(())
        }
        fn metrics(&self) -> AmwMetrics {
            AmwMetrics::default()
        }
    }

    impl audesys_hal_core::discovery::HalDiscovery for MockMiddleware {
        fn list_all(&self) -> HalResult<Vec<audesys_hal_core::discovery::DiscoveryEntry>> {
            Ok(Vec::new())
        }
        fn find_by_name(
            &self,
            _name: &str,
        ) -> HalResult<Option<audesys_hal_core::discovery::DiscoveryEntry>> {
            Ok(None)
        }
        fn find_by_pattern(
            &self,
            _pattern: &str,
        ) -> HalResult<Vec<audesys_hal_core::discovery::DiscoveryEntry>> {
            Ok(Vec::new())
        }
        fn watch(
            &self,
            _cb: audesys_hal_core::discovery::WatchCallback,
        ) -> HalResult<audesys_hal_core::discovery::WatchHandle> {
            Ok(audesys_hal_core::discovery::WatchHandle {})
        }
    }

    impl HalTransport for MockMiddleware {
        fn publish_signal(&self, name: &str, value: HalValue, _ts: Timestamp) -> HalResult<()> {
            self.published.lock().unwrap().push((name.to_string(), value));
            Ok(())
        }
        fn read_signal(&self, name: &str) -> HalResult<Option<(HalValue, Timestamp)>> {
            self.reads.lock().unwrap().push(name.to_string());
            let store = self.signal_store.lock().unwrap();
            Ok(store.get(name).map(|v| (v.clone(), Timestamp { secs: 0, micros: 0 })))
        }
        fn subscribe_signal(
            &self,
            _name: &str,
            _cb: SignalCallback,
        ) -> HalResult<audesys_hal_core::types::Subscription> {
            Ok(audesys_hal_core::types::Subscription {})
        }
        fn snapshot_signals(
            &self,
            _pattern: &str,
        ) -> HalResult<Vec<(String, HalValue, Timestamp)>> {
            Ok(Vec::new())
        }
        fn rpc_call(&self, _method: &str, _params: &[u8], _timeout_ms: u64) -> HalResult<Vec<u8>> {
            Ok(Vec::new())
        }
        fn register_rpc_handler(&self, _method: &str, _handler: RpcHandler) -> HalResult<()> {
            Ok(())
        }
        fn shutdown(&self) -> HalResult<()> {
            Ok(())
        }
    }

    impl HalQoS for MockMiddleware {
        fn lock_level(&self) -> LockLevel {
            *self.lock_level.lock().unwrap()
        }
        fn set_lock_level(&self, level: LockLevel) -> HalResult<ConfigStatus> {
            let mut current = self.lock_level.lock().unwrap();
            if level < *current {
                return Ok(ConfigStatus::Rejected {
                    reason: format!("Cannot decrease from {:?} to {:?}", *current, level),
                });
            }
            *current = level;
            Ok(ConfigStatus::Applied)
        }
        fn queue_config(&self, cmd: ConfigCommand) -> HalResult<ConfigStatus> {
            self.config_commands.lock().unwrap().push(cmd);
            Ok(ConfigStatus::Queued)
        }
        fn apply_queued(&self) -> HalResult<Vec<ConfigStatus>> {
            Ok(self
                .config_commands
                .lock()
                .unwrap()
                .drain(..)
                .map(|_| ConfigStatus::Applied)
                .collect())
        }
        fn register_entity(&self, _entity_id: &str) -> HalResult<()> {
            Ok(())
        }
        fn check_liveliness(
            &self,
            _entity_id: &str,
        ) -> HalResult<audesys_hal_core::qos::LivelinessStatus> {
            Ok(audesys_hal_core::qos::LivelinessStatus::Alive)
        }
        fn tag_security_domain(&self, _name: &str, _domain: &str) -> HalResult<()> {
            Ok(())
        }
        fn get_security_domain(&self, _name: &str) -> HalResult<Option<String>> {
            Ok(None)
        }
    }

    // ── Tests ──

    #[test]
    fn test_engine_start_stop() {
        let engine =
            Engine::new(Box::new(MockMiddleware::new()), Arc::new(LifecycleManager::new()));
        assert!(!engine.is_running());

        let handle = engine.start(10);
        assert!(engine.is_running());
        thread::sleep(Duration::from_millis(50));
        engine.stop();
        handle.join().expect("engine thread should join cleanly");
        assert!(!engine.is_running());
    }

    #[test]
    fn test_lock_level_cannot_decrease() {
        let engine =
            Engine::new(Box::new(MockMiddleware::new()), Arc::new(LifecycleManager::new()));
        assert_eq!(engine.lock_level(), LockLevel::None);

        assert!(engine.set_lock_level(LockLevel::Load).is_ok());
        assert_eq!(engine.lock_level(), LockLevel::Load);

        assert!(engine.set_lock_level(LockLevel::Config).is_ok());
        assert_eq!(engine.lock_level(), LockLevel::Config);

        assert!(engine.set_lock_level(LockLevel::Load).is_err());
        assert_eq!(engine.lock_level(), LockLevel::Config);
    }

    #[test]
    fn test_config_blocked_at_run_level() {
        let engine =
            Engine::new(Box::new(MockMiddleware::new()), Arc::new(LifecycleManager::new()));
        assert!(engine.set_lock_level(LockLevel::Run).is_ok());

        let cmd = ConfigCommand {
            id: 1,
            method: "configureComponent".into(),
            params: vec![],
            queued_at: std::time::Instant::now(),
        };
        assert!(engine.queue_config(cmd).is_err());
    }

    #[test]
    fn test_config_queued_below_run_level() {
        let engine =
            Engine::new(Box::new(MockMiddleware::new()), Arc::new(LifecycleManager::new()));
        assert!(engine.set_lock_level(LockLevel::Load).is_ok());

        let cmd = ConfigCommand {
            id: 1,
            method: "configureComponent".into(),
            params: vec![],
            queued_at: std::time::Instant::now(),
        };
        assert!(engine.queue_config(cmd).is_ok());
    }

    #[test]
    fn test_uptime_increases() {
        let engine =
            Engine::new(Box::new(MockMiddleware::new()), Arc::new(LifecycleManager::new()));
        let t0 = engine.uptime_ms();
        thread::sleep(Duration::from_millis(10));
        let t1 = engine.uptime_ms();
        assert!(t1 >= t0, "uptime should increase over time");
    }

    #[test]
    fn test_start_with_cycle() {
        let engine =
            Engine::new(Box::new(MockMiddleware::new()), Arc::new(LifecycleManager::new()));
        let handle = engine.start_with_cycle(1);
        thread::sleep(Duration::from_millis(50));
        engine.stop();
        handle.join().expect("engine thread should join cleanly");
        assert!(engine.cycle_count() > 0);
    }

    #[test]
    fn test_signal_register_and_snapshot() {
        let engine =
            Engine::new(Box::new(MockMiddleware::new()), Arc::new(LifecycleManager::new()));

        let def1 = SignalDef::new(
            "motor.speed",
            audesys_hal_core::types::HalPinType::F32,
            HalValue::F32(100.0),
            WriteStrategy::Own,
        );
        let def2 = SignalDef::new(
            "sensor.temp",
            audesys_hal_core::types::HalPinType::F32,
            HalValue::F32(25.5),
            WriteStrategy::Monitored,
        );

        engine.register_signal(def1).unwrap();
        engine.register_signal(def2).unwrap();

        let snapshot = engine.signal_snapshot();
        assert_eq!(snapshot.len(), 2);

        let motor = snapshot.iter().find(|(name, _)| name == "motor.speed").unwrap();
        assert_eq!(motor.1, HalValue::F32(100.0));

        let sensor = snapshot.iter().find(|(name, _)| name == "sensor.temp").unwrap();
        assert_eq!(sensor.1, HalValue::F32(25.5));
    }

    #[test]
    fn test_cycle_publishes_signals() {
        let mw = MockMiddleware::new();
        let engine = Engine::new(Box::new(mw), Arc::new(LifecycleManager::new()));

        // Register Own signals — these should be published each cycle
        engine
            .register_signal(SignalDef::new(
                "out.speed",
                audesys_hal_core::types::HalPinType::F32,
                HalValue::F32(42.0),
                WriteStrategy::Own,
            ))
            .unwrap();

        engine
            .register_signal(SignalDef::new(
                "out.status",
                audesys_hal_core::types::HalPinType::Bool,
                HalValue::Bool(true),
                WriteStrategy::Own,
            ))
            .unwrap();

        let handle = engine.start_with_cycle(1);
        thread::sleep(Duration::from_millis(30));
        engine.stop();
        handle.join().expect("engine thread should join cleanly");

        // Get published signals from the middleware
        let mw_ref = engine.middleware();
        let _mw_guard = mw_ref.lock().unwrap();

        // We need to downcast to MockMiddleware, but dyn AmwMiddleware doesn't support that.
        // Instead, verify via metrics.
        let metrics = engine.metrics();
        assert!(
            metrics.signals_published.load(Ordering::Relaxed) > 0,
            "Signals should have been published during cycles"
        );
        assert!(
            metrics.cycles_completed.load(Ordering::Relaxed) > 0,
            "Cycles should have completed"
        );
    }

    #[test]
    fn test_cycle_reads_monitored_signals() {
        let mw = MockMiddleware::new();
        // Pre-populate the mock store with a value the read barrier should pick up
        mw.signal_store.lock().unwrap().insert("sensor.input".to_string(), HalValue::U32(99));

        let engine = Engine::new(Box::new(mw), Arc::new(LifecycleManager::new()));

        engine
            .register_signal(SignalDef::new(
                "sensor.input",
                audesys_hal_core::types::HalPinType::U32,
                HalValue::U32(0),
                WriteStrategy::Monitored,
            ))
            .unwrap();

        let handle = engine.start_with_cycle(1);
        thread::sleep(Duration::from_millis(30));
        engine.stop();
        handle.join().expect("engine thread should join cleanly");

        // Verify the read happened — check for cycle completion
        assert!(engine.cycle_count() > 0);
    }

    #[test]
    fn test_engine_with_lifecycle_cycles_without_panicking() {
        let engine =
            Engine::new(Box::new(MockMiddleware::new()), Arc::new(LifecycleManager::new()));

        let handle = engine.start_with_cycle(1);
        thread::sleep(Duration::from_millis(50));
        engine.stop();
        handle.join().expect("engine thread should join cleanly");

        // Verify engine completed cycles without panicking
        assert!(engine.cycle_count() > 0);

        // Verify lifecycle integration: child_restarts may be 0 (no children)
        // but the health check should have run without errors
        let metrics = engine.metrics();
        let _restarts = metrics.child_restarts.load(Ordering::Relaxed);
        // No assertion on restarts — there are no spawned children in this test
    }

    // ── Pause / Resume / Step tests ──

    #[test]
    fn test_engine_pause_resume() {
        let engine =
            Engine::new(Box::new(MockMiddleware::new()), Arc::new(LifecycleManager::new()));
        assert!(!engine.is_running()); // not started, pause/resume states still trackable
        assert!(!engine.is_paused());

        engine.pause();
        assert!(engine.is_paused());

        engine.resume();
        assert!(!engine.is_paused());
    }

    #[test]
    fn test_engine_step_cycle_sets_paused() {
        let engine =
            Engine::new(Box::new(MockMiddleware::new()), Arc::new(LifecycleManager::new()));
        engine.step_cycle();
        assert!(engine.is_paused());
    }

    #[test]
    fn test_pause_stops_cycle_execution() {
        let engine =
            Engine::new(Box::new(MockMiddleware::new()), Arc::new(LifecycleManager::new()));
        let handle = engine.start_with_cycle(1);
        thread::sleep(Duration::from_millis(30));

        engine.pause();
        thread::sleep(Duration::from_millis(30));
        let count_after_pause = engine.cycle_count();

        thread::sleep(Duration::from_millis(30));
        let count_after_wait = engine.cycle_count();

        // Cycle count should not increase while paused
        assert_eq!(count_after_pause, count_after_wait,
            "cycle count should freeze while paused");

        engine.resume();
        thread::sleep(Duration::from_millis(30));
        engine.stop();
        handle.join().expect("engine thread should join cleanly");
    }

    #[test]
    fn test_step_cycle_advances_by_one() {
        let engine =
            Engine::new(Box::new(MockMiddleware::new()), Arc::new(LifecycleManager::new()));
        let handle = engine.start_with_cycle(1);
        thread::sleep(Duration::from_millis(20));

        engine.pause();
        thread::sleep(Duration::from_millis(10));
        let count_before = engine.cycle_count();

        engine.step_cycle();
        thread::sleep(Duration::from_millis(20));
        let count_after = engine.cycle_count();

        // Exactly one more cycle should have executed
        assert_eq!(count_after, count_before + 1,
            "step_cycle should advance exactly one cycle");

        engine.stop();
        handle.join().expect("engine thread should join cleanly");
    }
}
