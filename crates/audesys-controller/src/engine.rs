//! Engine — the hard real-time execution loop.
//!
//! The Engine wraps a Box<dyn AmwMiddleware> and executes the
//! read_barrier → execute_functions → write_barrier cycle from
//! the HAL design documents.
//!
//! 来源: docs/modules/hal/thread-scheduling-design.md (D13)
//!       docs/modules/hal/config-barrier-design.md (D17)

use audesys_hal_core::middleware::AmwMiddleware;
use audesys_hal_core::qos::{ConfigCommand, ConfigStatus, LockLevel};
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
}

impl Engine {
    /// Create a new engine with the given middleware.
    /// The engine starts in LockLevel::None (fully configurable).
    pub fn new(middleware: Box<dyn AmwMiddleware>) -> Self {
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
    /// the full read→compute→write cycle. Use this when HAL functions are registered.
    pub fn start_with_cycle(&self, cycle_interval_ms: u64) -> JoinHandle<()> {
        self.running.store(true, Ordering::SeqCst);
        let middleware = Arc::clone(&self.middleware);
        let running = Arc::clone(&self.running);
        let config_queue = Arc::clone(&self.config_queue);
        let cycle_count = Arc::clone(&self.cycle_count);

        thread::spawn(move || {
            let interval = Duration::from_millis(cycle_interval_ms);
            let mut next_cycle = Instant::now();

            while running.load(Ordering::SeqCst) {
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

                // 2-4. Read→Compute→Write (skeleton — no functions registered yet)
                cycle_count.fetch_add(1, Ordering::Relaxed);

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
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;
    use audesys_hal_core::middleware::AmwMetrics;
    use audesys_hal_core::qos::HalQoS;
    use audesys_hal_core::transport::HalTransport;
    use audesys_hal_core::types::HalResult;
    use std::time::Duration;

    /// Minimal mock AmwMiddleware for unit tests.
    struct MockMiddleware {
        lock_level: Mutex<LockLevel>,
        config_commands: Mutex<Vec<ConfigCommand>>,
    }

    impl MockMiddleware {
        fn new() -> Self {
            Self {
                lock_level: Mutex::new(LockLevel::None),
                config_commands: Mutex::new(Vec::new()),
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
        fn publish_signal(
            &self,
            _name: &str,
            _value: audesys_hal_core::value::HalValue,
            _ts: audesys_hal_core::types::Timestamp,
        ) -> HalResult<()> {
            Ok(())
        }
        fn read_signal(
            &self,
            _name: &str,
        ) -> HalResult<
            Option<(audesys_hal_core::value::HalValue, audesys_hal_core::types::Timestamp)>,
        > {
            Ok(None)
        }
        fn subscribe_signal(
            &self,
            _name: &str,
            _cb: audesys_hal_core::transport::SignalCallback,
        ) -> HalResult<audesys_hal_core::types::Subscription> {
            // ponytail: Subscription is opaque — construct empty token
            use audesys_hal_core::types::Subscription;
            Ok(Subscription {})
        }
        fn snapshot_signals(
            &self,
            _pattern: &str,
        ) -> HalResult<
            Vec<(String, audesys_hal_core::value::HalValue, audesys_hal_core::types::Timestamp)>,
        > {
            Ok(Vec::new())
        }
        fn rpc_call(&self, _method: &str, _params: &[u8], _timeout_ms: u64) -> HalResult<Vec<u8>> {
            Ok(Vec::new())
        }
        fn register_rpc_handler(
            &self,
            _method: &str,
            _handler: audesys_hal_core::transport::RpcHandler,
        ) -> HalResult<()> {
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
        let engine = Engine::new(Box::new(MockMiddleware::new()));
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
        let engine = Engine::new(Box::new(MockMiddleware::new()));
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
        let engine = Engine::new(Box::new(MockMiddleware::new()));
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
        let engine = Engine::new(Box::new(MockMiddleware::new()));
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
        let engine = Engine::new(Box::new(MockMiddleware::new()));
        let t0 = engine.uptime_ms();
        thread::sleep(Duration::from_millis(10));
        let t1 = engine.uptime_ms();
        assert!(t1 >= t0, "uptime should increase over time");
    }

    #[test]
    fn test_start_with_cycle() {
        let mw = MockMiddleware::new();
        *mw.lock_level.lock().unwrap() = LockLevel::Config;
        mw.config_commands.lock().unwrap().push(ConfigCommand {
            id: 1,
            method: "test".into(),
            params: vec![1, 2, 3],
            queued_at: std::time::Instant::now(),
        });

        let engine = Engine::new(Box::new(mw));
        let handle = engine.start_with_cycle(1);
        thread::sleep(Duration::from_millis(50));
        engine.stop();
        handle.join().expect("engine thread should join cleanly");
        assert!(engine.cycle_count() > 0);
    }
}
