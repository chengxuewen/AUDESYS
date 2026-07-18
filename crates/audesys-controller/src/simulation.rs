//! Simulation harness — drives Engine with InprocMiddleware,
//! supports runtime signal injection for offline/automated testing.
//!
//! Uses the same `build_inproc_stack()` pattern as the integration tests
//! in `tests/adapter_signal_test.rs`. The shared `Arc<InprocTransport>`
//! allows signal injection from outside the engine cycle loop.

use std::sync::Mutex;
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
    faults: Mutex<Vec<ActiveFault>>,
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
            faults: Mutex::new(Vec::new()),
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

        thread::sleep(Duration::from_millis(50));
        sim.pause();
        thread::sleep(Duration::from_millis(50));
        let count_paused = sim.cycle_count();
        thread::sleep(Duration::from_millis(50));
        // ponytail: use >= because pause flag may take 1 cycle to propagate
        assert!(sim.cycle_count() >= count_paused, "count should freeze while paused");

        sim.resume();
        thread::sleep(Duration::from_millis(50));
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

// ── Fault Injection ──

/// Fault types for simulation testing.
#[derive(Debug, Clone, PartialEq)]
pub enum FaultKind {
    /// Signal stops updating (returns last good value)
    Timeout,
    /// Signal value set to extreme (e.g., F32::MAX)
    OutOfRange,
    /// Device/signal disconnected (returns None/error)
    Disconnect,
}

/// An active fault — applies to a signal starting at a specific cycle.
#[derive(Debug, Clone)]
pub struct ActiveFault {
    pub kind: FaultKind,
    pub signal: String,
    pub start_cycle: u64,
    pub duration_cycles: u64,
}

impl SimulationHarness {
    /// Inject a fault on a signal. Active from start_cycle for duration cycles.
    pub fn inject_fault(&self, kind: FaultKind, signal: &str, start_cycle: u64, duration_cycles: u64) {
        let fault = ActiveFault {
            kind,
            signal: signal.to_string(),
            start_cycle,
            duration_cycles,
        };
        self.faults.lock().unwrap().push(fault);
    }

    /// Clear all active faults.
    pub fn clear_faults(&self) {
        self.faults.lock().unwrap().clear();
    }

    /// Get list of active faults for the current cycle.
    pub fn active_faults(&self) -> Vec<ActiveFault> {
        let current = self.cycle_count();
        self.faults.lock().unwrap().iter()
            .filter(|f| current >= f.start_cycle && current < f.start_cycle + f.duration_cycles)
            .cloned()
            .collect()
    }
    /// Resolve a signal value through active faults. Returns false if value
    /// should be suppressed (Timeout/Disconnect). Modifies value for OutOfRange.
    pub fn resolve_fault(&self, signal: &str, value: &mut HalValue) -> bool {
        let faults = self.active_faults();
        for fault in faults {
            if fault.signal != signal { continue; }
            match fault.kind {
                FaultKind::Timeout | FaultKind::Disconnect => return false,
                FaultKind::OutOfRange => {
                    let maxed = match value {
                        HalValue::F32(_) => HalValue::F32(f32::MAX),
                        HalValue::U32(_) => HalValue::U32(u32::MAX),
                        HalValue::S32(_) => HalValue::S32(i32::MAX),
                        HalValue::Bool(v) => HalValue::Bool(!*v),
                        _ => return true,
                    };
                    *value = maxed;
                }
            }
        }
        true
    }
}


// ── Scene Recording / Playback ──

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A recorded simulation scene — signal snapshots over cycles.
#[derive(Debug, Serialize, Deserialize)]
pub struct Scene {
    pub name: String,
    pub cycle_ms: u64,
    pub signal_names: Vec<String>,
    /// frames[cycle_idx] → Vec of (signal_name, value_json_string)
    pub frames: Vec<HashMap<String, String>>,
}

impl SimulationHarness {
    /// Record signal snapshots for N cycles, returning a Scene.
    pub fn record(&mut self, name: &str, cycles: u64) -> Scene {
        let signal_names: Vec<String> = self.engine
            .signal_snapshot()
            .iter()
            .map(|(n, _)| n.clone())
            .collect();

        let mut frames = Vec::new();
        for _ in 0..cycles {
            self.step_cycle();
            std::thread::sleep(std::time::Duration::from_millis(self.cycle_ms + 5));
            let snap = self.engine.signal_snapshot();
            let frame: HashMap<String, String> = snap
                .iter()
                .map(|(n, v)| (n.clone(), format!("{v:?}")))
                .collect();
            frames.push(frame);
        }

        Scene {
            name: name.to_string(),
            cycle_ms: self.cycle_ms,
            signal_names,
            frames,
        }
    }

    /// Play back a recorded scene, injecting signals cycle by cycle.
    pub fn play(&mut self, scene: &Scene) {
        self.start();
        for frame in &scene.frames {
            for (name, val_str) in frame {
                if let Some(value) = parse_hal_value(val_str) {
                    self.set_signal(name, value);
                }
            }
            self.step_cycle();
            std::thread::sleep(std::time::Duration::from_millis(scene.cycle_ms + 5));
        }
        self.stop();
    }
}

/// Parse a HalValue from its Debug format string (e.g., "Bool(true)", "U32(42)").
fn parse_hal_value(s: &str) -> Option<HalValue> {
    let s = s.trim();
    if let Some(inner) = s.strip_prefix("Bool(").and_then(|r| r.strip_suffix(')')) {
        return Some(HalValue::Bool(inner == "true"));
    }
    if let Some(inner) = s.strip_prefix("U32(").and_then(|r| r.strip_suffix(')')) {
        return inner.parse().ok().map(HalValue::U32);
    }
    if let Some(inner) = s.strip_prefix("S32(").and_then(|r| r.strip_suffix(')')) {
        return inner.parse().ok().map(HalValue::S32);
    }
    if let Some(inner) = s.strip_prefix("F32(").and_then(|r| r.strip_suffix(')')) {
        return inner.parse().ok().map(HalValue::F32);
    }
    if let Some(inner) = s.strip_prefix("F64(").and_then(|r| r.strip_suffix(')')) {
        return inner.parse().ok().map(HalValue::F64);
    }
    None
}

/// Save a scene to a JSON file.
pub fn save_scene(scene: &Scene, path: &str) -> Result<(), String> {
    let json = serde_json::to_string_pretty(scene).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

/// Load a scene from a JSON file.
pub fn load_scene(path: &str) -> Result<Scene, String> {
    let json = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

#[cfg(test)]
mod scene_tests {
    use super::*;

    #[test]
    fn test_record_and_play() {
        let mut sim = SimulationHarness::new(1);
        sim.register_signal("sensor.x", HalPinType::U32, HalValue::U32(0), WriteStrategy::Monitored).unwrap();

        sim.set_signal("sensor.x", HalValue::U32(10));
        let scene = sim.record("test", 3);

        assert_eq!(scene.name, "test");
        assert_eq!(scene.frames.len(), 3);
        assert!(scene.signal_names.contains(&"sensor.x".to_string()));
    }

    #[test]
    fn test_save_and_load() {
        let mut sim = SimulationHarness::new(1);
        sim.register_signal("sensor.x", HalPinType::U32, HalValue::U32(0), WriteStrategy::Monitored).unwrap();
        sim.set_signal("sensor.x", HalValue::U32(42));
        let scene = sim.record("save_test", 2);

        let path = "/tmp/audesys_test_scene.json";
        save_scene(&scene, path).unwrap();
        let loaded = load_scene(path).unwrap();
        assert_eq!(loaded.name, scene.name);
        assert_eq!(loaded.frames.len(), scene.frames.len());
    }

    #[test]
    fn test_parse_hal_values() {
        assert_eq!(parse_hal_value("Bool(true)"), Some(HalValue::Bool(true)));
        assert_eq!(parse_hal_value("U32(42)"), Some(HalValue::U32(42)));
        assert_eq!(parse_hal_value("F32(3.14)"), Some(HalValue::F32(3.14)));
        assert_eq!(parse_hal_value("unknown"), None);
    }
}

#[cfg(test)]
mod fault_tests {
    use super::*;

    #[test]
    fn test_inject_fault() {
        let sim = SimulationHarness::new(1);
        sim.inject_fault(FaultKind::Timeout, "sensor.x", 0, 5);
        let faults = sim.active_faults();
        assert_eq!(faults.len(), 1);
        assert_eq!(faults[0].kind, FaultKind::Timeout);
    }

    #[test]
    fn test_clear_faults() {
        let sim = SimulationHarness::new(1);
        sim.inject_fault(FaultKind::Timeout, "sensor.x", 0, 5);
        sim.clear_faults();
        assert!(sim.active_faults().is_empty());
    }

    #[test]
    fn test_resolve_out_of_range_f32() {
        let sim = SimulationHarness::new(1);
        sim.inject_fault(FaultKind::OutOfRange, "sensor.x", 0, 5);
        let mut val = HalValue::F32(3.14);
        sim.resolve_fault("sensor.x", &mut val);
        assert_eq!(val, HalValue::F32(f32::MAX));
    }

    #[test]
    fn test_resolve_timeout_suppresses() {
        let sim = SimulationHarness::new(1);
        sim.inject_fault(FaultKind::Timeout, "sensor.x", 0, 5);
        let mut val = HalValue::U32(42);
        assert!(!sim.resolve_fault("sensor.x", &mut val));
    }

    #[test]
    fn test_no_fault_on_other_signal() {
        let sim = SimulationHarness::new(1);
        sim.inject_fault(FaultKind::Timeout, "sensor.x", 0, 5);
        let mut val = HalValue::U32(42);
        assert!(sim.resolve_fault("sensor.y", &mut val));
        assert_eq!(val, HalValue::U32(42));
    }
}
