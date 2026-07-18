//! Simulation harness — drives Engine with InprocMiddleware,
//! supports runtime signal injection for offline/automated testing.
//!
//! Uses the same `build_inproc_stack()` pattern as the integration tests
//! in `tests/adapter_signal_test.rs`. The shared `Arc<InprocTransport>`
//! allows signal injection from outside the engine cycle loop.

use std::sync::Arc;
use std::thread;
use std::time::Duration;

use audesys_amw_inproc::{InprocAuditLog, InprocMiddleware, InprocQoS, InprocTransport, StaticDiscovery};
use audesys_hal_core::{HalPinType, HalTransport, HalValue, Timestamp};

use crate::engine::Engine;
use crate::lifecycle::LifecycleManager;
use crate::signals::{SignalDef, WriteStrategy};

/// Build the in-process middleware stack, returning both the middleware
/// (for Engine construction) and a shared transport handle (for signal injection).
fn build_inproc_stack() -> (Arc<InprocTransport>, InprocMiddleware) {
    let transport = Arc::new(InprocTransport::new());
    let signal_reg = transport.signal_registry();
    let discovery = Arc::new(StaticDiscovery::new(signal_reg));
    let qos = Arc::new(InprocQoS::new());
    let audit = Arc::new(InprocAuditLog::new());
    let mw = InprocMiddleware::new(Arc::clone(&transport), discovery, qos, audit);
    (transport, mw)
}

/// Harness that runs Engine with InprocMiddleware for simulation.
///
/// # Signal injection
///
/// Call `set_signal()` to simulate sensor/input changes. These are written
/// directly to the shared InprocTransport signal registry and picked up by
/// the Engine's Read Barrier on the next cycle (for Monitored signals).
///
/// # Example
///
/// ```ignore
/// let sim = SimulationHarness::new(10);
/// sim.register_signal("sensor.temp", HalPinType::F32, HalValue::F32(0.0), WriteStrategy::Monitored);
/// sim.register_signal("out.speed", HalPinType::F32, HalValue::F32(0.0), WriteStrategy::Own);
/// sim.set_signal("sensor.temp", HalValue::F32(42.0));
/// sim.run_cycles(5);
/// let snap = sim.signal_snapshot();
/// ```
pub struct SimulationHarness {
    engine: Engine,
    transport: Arc<InprocTransport>,
    cycle_ms: u64,
    handle: Option<thread::JoinHandle<()>>,
}

impl SimulationHarness {
    /// Create a new simulation harness with the given cycle interval in milliseconds.
    pub fn new(cycle_ms: u64) -> Self {
        let (transport, mw) = build_inproc_stack();
        let engine = Engine::new(Box::new(mw), Arc::new(LifecycleManager::new()));
        Self {
            engine,
            transport,
            cycle_ms,
            handle: None,
        }
    }

    // ── Signal Management ──

    /// Register a signal definition for the simulation.
    pub fn register_signal(
        &self,
        name: &str,
        pin_type: HalPinType,
        value: HalValue,
        strategy: WriteStrategy,
    ) -> Result<(), String> {
        self.engine
            .register_signal(SignalDef::new(name, pin_type, value, strategy))
    }

    /// Inject a signal value — publish directly to the shared transport.
    ///
    /// Simulates sensor/input changes. Monitored signals registered on the engine
    /// will pick this up on the next cycle's Read Barrier.
    pub fn set_signal(&self, name: &str, value: HalValue) {
        let ts = Timestamp { secs: 0, micros: 0 };
        // ponytail: ignore publish errors — simulation, not production
        let _ = self.transport.publish_signal(name, value, ts);
    }

    /// Read a signal value directly from the transport (bypasses engine snapshot).
    pub fn get_signal(&self, name: &str) -> Option<HalValue> {
        self.transport
            .read_signal(name)
            .ok()
            .flatten()
            .map(|(v, _)| v)
    }

    /// Take a signal snapshot from the engine's signal registry.
    pub fn signal_snapshot(&self) -> Vec<(String, HalValue)> {
        self.engine.signal_snapshot()
    }

    // ── Cycle Control ──

    /// Start the engine cycle loop. Returns immediately.
    pub fn start(&mut self) {
        if self.handle.is_some() {
            return; // already running
        }
        self.handle = Some(self.engine.start_with_cycle(self.cycle_ms));
    }

    /// Stop the engine and wait for the cycle thread to join.
    pub fn stop(&mut self) {
        self.engine.stop();
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }

    /// Pause engine execution (see Engine::pause).
    pub fn pause(&self) {
        self.engine.pause();
    }

    /// Resume engine execution (see Engine::resume).
    pub fn resume(&self) {
        self.engine.resume();
    }

    /// Step exactly one cycle then pause. Engine must be started and paused.
    pub fn step_cycle(&self) {
        self.engine.step_cycle();
    }

    /// Run for a specified number of milliseconds, then stop.
    ///
    /// Convenience for: start → sleep(duration_ms) → stop
    pub fn run_for(&mut self, duration_ms: u64) {
        self.start();
        thread::sleep(Duration::from_millis(duration_ms));
        self.stop();
    }

    /// Run for approximately N cycles. Blocks until complete.
    ///
    /// Calculates sleep time from N × cycle_ms plus a small buffer for thread scheduling.
    pub fn run_cycles(&mut self, n: u64) {
        let runtime = self.cycle_ms * n + 20; // 20ms buffer for thread scheduling
        self.run_for(runtime);
    }

    // ── Metrics ──

    /// Get the number of completed engine cycles.
    pub fn cycle_count(&self) -> u64 {
        self.engine.cycle_count()
    }

    /// Get the number of signals published (across all cycles).
    pub fn signals_published(&self) -> u64 {
        self.engine.metrics()
            .signals_published
            .load(std::sync::atomic::Ordering::Relaxed)
    }

    /// Check if the engine is currently running.
    pub fn is_running(&self) -> bool {
        self.engine.is_running()
    }
}

impl Drop for SimulationHarness {
    fn drop(&mut self) {
        if self.is_running() {
            self.stop();
        }
    }
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_harness_create_and_stop() {
        let mut sim = SimulationHarness::new(1);
        sim.run_for(30);
        assert!(sim.cycle_count() > 0);
        assert!(!sim.is_running());
    }

    #[test]
    fn test_harness_signal_injection() {
        let mut sim = SimulationHarness::new(1);

        // Register a Monitored signal (engine reads from transport)
        sim.register_signal(
            "sensor.input",
            HalPinType::U32,
            HalValue::U32(0),
            WriteStrategy::Monitored,
        )
        .unwrap();

        // Inject a value before starting
        sim.set_signal("sensor.input", HalValue::U32(42));

        sim.run_cycles(5);

        // Verify the injected signal was read by the engine
        let snapshot = sim.signal_snapshot();
        let sensor = snapshot
            .iter()
            .find(|(name, _)| name == "sensor.input")
            .expect("sensor.input should be in snapshot");
        assert_eq!(sensor.1, HalValue::U32(42));
    }

    #[test]
    fn test_harness_multiple_signals() {
        let mut sim = SimulationHarness::new(1);

        sim.register_signal(
            "sensor.temp",
            HalPinType::F32,
            HalValue::F32(0.0),
            WriteStrategy::Monitored,
        )
        .unwrap();
        sim.register_signal(
            "sensor.pressure",
            HalPinType::F32,
            HalValue::F32(0.0),
            WriteStrategy::Monitored,
        )
        .unwrap();

        sim.set_signal("sensor.temp", HalValue::F32(25.5));
        sim.set_signal("sensor.pressure", HalValue::F32(1013.25));

        sim.run_cycles(3);

        let snapshot = sim.signal_snapshot();
        let temp = snapshot
            .iter()
            .find(|(name, _)| name == "sensor.temp")
            .unwrap();
        let pressure = snapshot
            .iter()
            .find(|(name, _)| name == "sensor.pressure")
            .unwrap();
        assert_eq!(temp.1, HalValue::F32(25.5));
        assert_eq!(pressure.1, HalValue::F32(1013.25));
    }

    #[test]
    fn test_harness_signal_update_between_runs() {
        let mut sim = SimulationHarness::new(1);

        sim.register_signal(
            "sensor.val",
            HalPinType::U32,
            HalValue::U32(0),
            WriteStrategy::Monitored,
        )
        .unwrap();

        // First run
        sim.set_signal("sensor.val", HalValue::U32(10));
        sim.run_cycles(3);
        let snap1 = sim.signal_snapshot();
        let v1 = snap1
            .iter()
            .find(|(name, _)| name == "sensor.val")
            .unwrap();
        assert_eq!(v1.1, HalValue::U32(10));

        // Second run — inject a new value
        sim.set_signal("sensor.val", HalValue::U32(20));
        sim.run_cycles(3);
        let snap2 = sim.signal_snapshot();
        let v2 = snap2
            .iter()
            .find(|(name, _)| name == "sensor.val")
            .unwrap();
        assert_eq!(v2.1, HalValue::U32(20));
    }

    #[test]
    fn test_harness_pause_resume() {
        let mut sim = SimulationHarness::new(1);
        sim.start();

        thread::sleep(Duration::from_millis(20));
        sim.pause();
        let count_paused = sim.cycle_count();
        thread::sleep(Duration::from_millis(20));
        assert_eq!(sim.cycle_count(), count_paused, "count should freeze while paused");

        sim.resume();
        thread::sleep(Duration::from_millis(20));
        sim.stop();

        assert!(sim.cycle_count() > count_paused, "count should increase after resume");
    }

    #[test]
    fn test_harness_get_signal_direct() {
        let sim = SimulationHarness::new(1);
        sim.set_signal("direct.signal", HalValue::Bool(true));
        let val = sim.get_signal("direct.signal");
        assert_eq!(val, Some(HalValue::Bool(true)));
    }
}
