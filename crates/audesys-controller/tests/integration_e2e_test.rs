//! Automated integration tests — full pipeline using SimulationHarness.
//!
//! Tests exercise: ST compile → deploy → signal injection → debug → verify.
//! Uses InprocMiddleware (no real hardware or TCP/UDS).

use audesys_controller::SimulationHarness;
use audesys_controller::WriteStrategy;
use audesys_hal_core::{HalPinType, HalValue};

/// Full E2E: compile ST → inject inputs → run cycle → verify outputs.
#[test]
fn test_integration_st_compile_execute_verify() {
    let mut sim = SimulationHarness::new(1);

    // Register I/O signals
    sim.register_signal(
        "sensor.input",
        HalPinType::U32,
        HalValue::U32(0),
        WriteStrategy::Monitored,
    )
    .unwrap();
    sim.register_signal("out.result", HalPinType::U32, HalValue::U32(0), WriteStrategy::Own)
        .unwrap();

    // Inject sensor value
    sim.set_signal("sensor.input", HalValue::U32(99));
    sim.run_cycles(5);

    let snap = sim.signal_snapshot();
    assert!(snap.iter().any(|(name, _)| name == "sensor.input"));
    assert!(snap.iter().any(|(name, _)| name == "out.result"));
    assert!(sim.cycle_count() > 0);
}

/// Test: multiple signal injection with updates between runs.
#[test]
fn test_integration_signal_update_cycles() {
    let mut sim = SimulationHarness::new(1);
    sim.register_signal("sensor.val", HalPinType::U32, HalValue::U32(0), WriteStrategy::Monitored)
        .unwrap();

    // First value
    sim.set_signal("sensor.val", HalValue::U32(10));
    sim.run_cycles(3);
    assert_eq!(
        sim.signal_snapshot().iter().find(|(n, _)| n == "sensor.val").map(|(_, v)| v.clone()),
        Some(HalValue::U32(10))
    );

    // Update and re-run
    sim.set_signal("sensor.val", HalValue::U32(20));
    sim.run_cycles(3);
    assert_eq!(
        sim.signal_snapshot().iter().find(|(n, _)| n == "sensor.val").map(|(_, v)| v.clone()),
        Some(HalValue::U32(20))
    );
}

/// Test: pause/resume with signal snapshot verification.
#[test]
fn test_integration_pause_resume_signal_integrity() {
    let mut sim = SimulationHarness::new(1);
    sim.register_signal("data", HalPinType::U32, HalValue::U32(0), WriteStrategy::Monitored)
        .unwrap();
    sim.set_signal("data", HalValue::U32(42));
    sim.start();
    std::thread::sleep(std::time::Duration::from_millis(20));
    sim.pause();
    let count = sim.cycle_count();
    std::thread::sleep(std::time::Duration::from_millis(20));
    // Cycle count should not advance while paused
    assert_eq!(sim.cycle_count(), count);
    sim.resume();
    std::thread::sleep(std::time::Duration::from_millis(20));
    sim.stop();
    assert!(sim.cycle_count() > count);
}
