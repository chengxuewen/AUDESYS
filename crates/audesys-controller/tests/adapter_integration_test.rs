//! Integration tests: AdapterManager + Engine + InprocMiddleware end-to-end.
//!
//! Verifies adapter lifecycle, signal flow through the shared transport,
//! and clean shutdown without relying on real Modbus/HART hardware.

use std::sync::Arc;
use std::thread;
use std::time::Duration;

use audesys_amw_inproc::{
    InprocAuditLog, InprocMiddleware, InprocQoS, InprocTransport, StaticDiscovery,
};
use audesys_controller::adapter_manager::AdapterManager;
use audesys_controller::{Engine, LifecycleManager, SignalDef, WriteStrategy};
use audesys_hal_core::{HalPinType, HalTransport, HalValue, Timestamp};

mod common;
use common::build_inproc_stack;

// ── tests ──
// ── tests ──

#[test]
fn test_adapter_manager_empty_lifecycle() {
    let mut mgr = AdapterManager::new();
    // start_all and stop_all on an empty manager must not panic
    mgr.start_all();
    mgr.stop_all();
}

#[test]
fn test_adapter_manager_default() {
    let mut mgr = AdapterManager::default();
    mgr.start_all();
    mgr.stop_all();
}

#[test]
fn test_signal_flow_through_engine() {
    let (transport, mw) = build_inproc_stack();
    let engine = Engine::new(Box::new(mw), Arc::new(LifecycleManager::new()));

    // Register a Monitored signal — the engine's read barrier will poll it
    engine
        .register_signal(SignalDef::new(
            "sensor.temp",
            HalPinType::F32,
            HalValue::F32(0.0),
            WriteStrategy::Monitored,
        ))
        .unwrap();

    // Publish a value into the shared transport BEFORE starting the engine
    transport
        .publish_signal("sensor.temp", HalValue::F32(42.0), Timestamp { secs: 1, micros: 0 })
        .unwrap();

    // Start the engine cycle — read barrier picks up transport values
    let handle = engine.start_with_cycle(1);
    thread::sleep(Duration::from_millis(50));
    engine.stop();
    handle.join().expect("engine thread should join cleanly");

    // The engine's read barrier should have updated the signal from transport
    let snapshot = engine.signal_snapshot();
    let (_, val) = snapshot
        .iter()
        .find(|(name, _)| name == "sensor.temp")
        .expect("sensor.temp signal should exist");
    assert_eq!(*val, HalValue::F32(42.0), "engine should pick up transport value");
}

#[test]
fn test_signal_flow_vector() {
    let (transport, mw) = build_inproc_stack();
    let engine = Engine::new(Box::new(mw), Arc::new(LifecycleManager::new()));

    // Register multiple Monitored signals
    for (name, val) in [
        ("motor.speed", HalValue::F32(1500.0)),
        ("motor.status", HalValue::Bool(true)),
        ("sensor.pressure", HalValue::S32(-5)),
    ] {
        engine
            .register_signal(SignalDef::new(
                name,
                val.pin_type(),
                HalValue::U32(0), // initial dummy
                WriteStrategy::Monitored,
            ))
            .unwrap();
        transport.publish_signal(name, val, Timestamp { secs: 1, micros: 0 }).unwrap();
    }

    let handle = engine.start_with_cycle(1);
    thread::sleep(Duration::from_millis(50));
    engine.stop();
    handle.join().expect("engine thread should join cleanly");

    let snapshot = engine.signal_snapshot();
    assert_eq!(snapshot.len(), 3);
    let speed = snapshot.iter().find(|(n, _)| n == "motor.speed").unwrap();
    assert_eq!(speed.1, HalValue::F32(1500.0));
    let status = snapshot.iter().find(|(n, _)| n == "motor.status").unwrap();
    assert_eq!(status.1, HalValue::Bool(true));
    let pressure = snapshot.iter().find(|(n, _)| n == "sensor.pressure").unwrap();
    assert_eq!(pressure.1, HalValue::S32(-5));
}

#[test]
fn test_clean_shutdown() {
    let (_transport, mw) = build_inproc_stack();
    let engine = Engine::new(Box::new(mw), Arc::new(LifecycleManager::new()));
    let mut mgr = AdapterManager::new();

    // Start both engine and adapter manager (empty, no real adapters)
    let eng_handle = engine.start_with_cycle(5);
    mgr.start_all();

    thread::sleep(Duration::from_millis(30));

    // Stop adapter manager first, then engine
    mgr.stop_all();
    engine.stop();
    eng_handle.join().expect("engine thread should join cleanly");

    // If we reach here without panic/timeout, shutdown was clean
    assert!(!engine.is_running());
    assert!(engine.cycle_count() > 0, "engine should have completed cycles");
}

#[test]
fn test_engine_metrics_after_signals() {
    let (transport, mw) = build_inproc_stack();
    let engine = Engine::new(Box::new(mw), Arc::new(LifecycleManager::new()));

    engine
        .register_signal(SignalDef::new(
            "out.valve",
            HalPinType::Bool,
            HalValue::Bool(false),
            WriteStrategy::Own,
        ))
        .unwrap();

    // Pre-populate a Monitored signal
    engine
        .register_signal(SignalDef::new(
            "in.sensor",
            HalPinType::F32,
            HalValue::F32(0.0),
            WriteStrategy::Monitored,
        ))
        .unwrap();
    transport
        .publish_signal(
            "in.sensor",
            HalValue::F32(std::f32::consts::PI),
            Timestamp { secs: 1, micros: 0 },
        )
        .unwrap();

    let handle = engine.start_with_cycle(1);
    thread::sleep(Duration::from_millis(50));
    engine.stop();
    handle.join().expect("engine thread should join cleanly");

    use std::sync::atomic::Ordering;
    let metrics = engine.metrics();
    assert!(metrics.cycles_completed.load(Ordering::Relaxed) > 0);
    assert!(metrics.signals_published.load(Ordering::Relaxed) > 0);
}
