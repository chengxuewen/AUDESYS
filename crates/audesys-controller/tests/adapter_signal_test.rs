//! Integration tests: signal flow from transport → engine.
//!
//! Verifies that signals published to the shared InprocTransport are read
//! by the Engine during its cycle and appear in signal_snapshot().
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use audesys_amw_inproc::{
    InprocAuditLog, InprocMiddleware, InprocQoS, InprocTransport, StaticDiscovery,
};
use audesys_controller::{Engine, LifecycleManager, SignalDef, WriteStrategy};
use audesys_hal_core::{HalPinType, HalTransport, HalValue, Timestamp};

// ── helpers ──
mod common;
use common::build_inproc_stack;

// ── tests ──

#[test]
fn test_signal_flows_from_transport_to_engine() {
    let (transport, mw) = build_inproc_stack();
    let engine = Engine::new(Box::new(mw), Arc::new(LifecycleManager::new()));

    // Pre-populate a signal in the transport
    transport
        .publish_signal("test.signal", HalValue::F32(3.14), Timestamp { secs: 1, micros: 0 })
        .unwrap();

    // Register as Monitored (engine reads from transport)
    engine
        .register_signal(SignalDef::new(
            "test.signal",
            HalPinType::F32,
            HalValue::F32(0.0),
            WriteStrategy::Monitored,
        ))
        .unwrap();

    let handle = engine.start_with_cycle(50);
    thread::sleep(Duration::from_millis(200));
    engine.stop();
    handle.join().expect("engine thread should join cleanly");

    let snapshot = engine.signal_snapshot();
    let pair = snapshot.iter().find(|(n, _)| n == "test.signal").expect("test.signal should exist");
    assert_eq!(pair.1, HalValue::F32(3.14), "engine should read transport value");
}

#[test]
fn test_signal_update_during_cycle() {
    let (transport, mw) = build_inproc_stack();
    let engine = Engine::new(Box::new(mw), Arc::new(LifecycleManager::new()));

    transport
        .publish_signal("dyn.signal", HalValue::S32(42), Timestamp { secs: 1, micros: 0 })
        .unwrap();

    engine
        .register_signal(SignalDef::new(
            "dyn.signal",
            HalPinType::S32,
            HalValue::S32(0),
            WriteStrategy::Monitored,
        ))
        .unwrap();

    let handle = engine.start_with_cycle(50);
    thread::sleep(Duration::from_millis(100));

    // Update the signal during runtime
    transport
        .publish_signal("dyn.signal", HalValue::S32(99), Timestamp { secs: 2, micros: 0 })
        .unwrap();
    thread::sleep(Duration::from_millis(150));

    engine.stop();
    handle.join().expect("engine thread should join cleanly");

    let snapshot = engine.signal_snapshot();
    let pair = snapshot.iter().find(|(n, _)| n == "dyn.signal").expect("dyn.signal should exist");
    assert_eq!(pair.1, HalValue::S32(99), "engine should read updated transport value");
}
