//! End-to-end pipeline test: ST source → compile → serialize →
//! controller loads → engine cycle executes → verify output.
//!
//! Verifies the full ST compiler → Controller pipeline works end-to-end.

use std::sync::Arc;
use std::thread;
use std::time::Duration;

use audesys_amw_inproc::{
    InprocAuditLog, InprocMiddleware, InprocQoS, InprocTransport, StaticDiscovery,
};
use audesys_controller::{Engine, LifecycleManager, SignalDef, WriteStrategy};
use audesys_hal_binding_gen::compile;
use audesys_hal_core::{HalPinType, HalValue};

// ── helpers ──

fn build_inproc_stack() -> (Arc<InprocTransport>, InprocMiddleware) {
    let transport = Arc::new(InprocTransport::new());
    let signal_reg = transport.signal_registry();
    let discovery = Arc::new(StaticDiscovery::new(signal_reg));
    let qos = Arc::new(InprocQoS::new());
    let audit = Arc::new(InprocAuditLog::new());
    let mw = InprocMiddleware::new(Arc::clone(&transport), discovery, qos, audit);
    (transport, mw)
}

// ── tests ──

#[test]
fn test_st_compile_to_controller_execution() {
    // 1. Compile ST source
    let st_source = "PROGRAM test_prog VAR x : INT; END_VAR; x := 42; END_PROGRAM";
    let program = compile(st_source).expect("ST compilation failed");
    assert!(program.is_well_formed(), "compiled program should be well-formed");

    // 2. Serialize to bytes
    let bytes = bincode::serialize(&program).expect("bincode serialization failed");

    // 3. Set up controller engine with inproc middleware
    let (_transport, mw) = build_inproc_stack();
    let lifecycle = Arc::new(LifecycleManager::new());
    let engine = Engine::new(Box::new(mw), Arc::clone(&lifecycle));

    // 4. Load program into engine
    engine.load_hal_program(&bytes).expect("failed to load HAL program into engine");

    // 5. Register signals matching VM variable names (output of ST program)
    engine
        .register_signal(SignalDef::new("x", HalPinType::S32, HalValue::S32(0), WriteStrategy::Own))
        .expect("failed to register x signal");

    // 6. Run engine cycles
    let handle = engine.start_with_cycle(50);
    thread::sleep(Duration::from_millis(200));
    engine.stop();
    handle.join().expect("engine thread should join cleanly");

    // 7. Verify output — VM signal 'x' should contain the compiled value
    let snapshot = engine.signal_snapshot();
    let output =
        snapshot.iter().find(|(name, _)| name == "x").expect("x signal not found in snapshot");
    assert_eq!(
        *output,
        (String::from("x"), HalValue::S32(42)),
        "expected compiled value S32(42) in signal x"
    );
}
