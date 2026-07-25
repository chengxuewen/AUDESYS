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
use audesys_runtime::{Engine, LifecycleManager, SignalDef, WriteStrategy};
use audesys_hal_binding_gen::compile;
use audesys_hal_core::{HalPinType, HalValue};

mod common;
use common::build_inproc_stack;

// ── tests ──
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
    let _ = engine.register_signal(SignalDef::new(
        "x",
        HalPinType::S32,
        HalValue::S32(0),
        WriteStrategy::Own,
    ));
    // ponytail: may already be registered by load_hal_program auto-binding

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
#[test]
fn test_demo_full_pipeline_with_debug() {
    // ── Phase 1: Compile ST with timer ──
    let src = concat!(
        "PROGRAM demo VAR ton1 : TON; trigger : BOOL; result : INT; END_VAR ",
        "ton1(trigger, 1000); ",
        "IF ton1.Q THEN result := 42; ELSE result := 0; END_IF; ",
        "END_PROGRAM",
    );
    let program = compile(src).expect("compilation");
    assert!(program.is_well_formed());
    let bytes = bincode::serialize(&program).unwrap();

    // ── Phase 2: Deploy to engine ──
    let (_transport, mw) = build_inproc_stack();
    let engine = Engine::new(Box::new(mw), Arc::new(LifecycleManager::new()));
    engine.load_hal_program(&bytes).unwrap();
    engine.start_with_cycle(10);
    thread::sleep(Duration::from_millis(30));

    engine.pause();
    assert!(engine.is_paused());
    engine.resume();
    engine.resume();
    thread::sleep(Duration::from_millis(50));
    engine.stop();

    let snapshot = engine.signal_snapshot();
    assert!(!snapshot.is_empty());
    assert!(snapshot.iter().any(|(name, _)| name == "result"));
}


#[test]
#[ignore = "VM-IL integration pending"]
fn test_ld_compile_to_controller_execution() {
    let ld_src = "NETWORK\n  NO X1\n  NO X2\n  OUT Y1";
    let il_text = audesys_ld_compiler::ld_compile(ld_src).expect("LD compile");
    let program = audesys_il_compiler::il_compile(&il_text).expect("IL compile");
    let bytes = bincode::serialize(&program).unwrap();
    let (_transport, mw) = build_inproc_stack();
    let engine = Engine::new(Box::new(mw), Arc::new(LifecycleManager::new()));
    engine.load_hal_program(&bytes).unwrap();
    let _ = engine.register_signal(SignalDef::new("X1", HalPinType::Bool, HalValue::Bool(true), WriteStrategy::Own));
    let _ = engine.register_signal(SignalDef::new("X2", HalPinType::Bool, HalValue::Bool(true), WriteStrategy::Own));
    let _ = engine.register_signal(SignalDef::new("Y1", HalPinType::Bool, HalValue::Bool(false), WriteStrategy::Own));
    let handle = engine.start_with_cycle(50);
    thread::sleep(Duration::from_millis(200));
    engine.stop(); handle.join().unwrap();
    let s = engine.signal_snapshot();
    let y1 = s.iter().find(|(n,_)| n=="Y1").unwrap();
    assert_eq!(y1.1, HalValue::Bool(true), "X1 AND X2 → Y1=true");
}

#[test]
#[ignore = "VM-IL integration pending"]
fn test_ld_nc_contact_to_controller() {
    let ld_src = "NETWORK\n  NC X1\n  OUT Y1";
    let il = audesys_ld_compiler::ld_compile(ld_src).unwrap();
    let p = audesys_il_compiler::il_compile(&il).unwrap();
    let bytes = bincode::serialize(&p).unwrap();
    let (_t, mw) = build_inproc_stack();
    let e = Engine::new(Box::new(mw), Arc::new(LifecycleManager::new()));
    e.load_hal_program(&bytes).unwrap();
    e.register_signal(SignalDef::new("X1", HalPinType::Bool, HalValue::Bool(false), WriteStrategy::Own));
    e.register_signal(SignalDef::new("Y1", HalPinType::Bool, HalValue::Bool(false), WriteStrategy::Own));
    let h = e.start_with_cycle(50);
    thread::sleep(Duration::from_millis(200));
    e.stop(); h.join().unwrap();
    let s = e.signal_snapshot();
    eprintln!("snapshot: {:?}", s);
    let y1 = s.iter().find(|(n,_)| n=="Y1").unwrap();
    assert_eq!(y1.1, HalValue::Bool(true), "NC: X1=false → contact CLOSED → Y1=true");
}

#[test]
#[ignore = "VM-IL integration pending"]
fn test_ld_set_reset_latch() {
    let ld_src = "NETWORK\n  NO X1\n  SET Y1\nNETWORK\n  NO X2\n  RESET Y1";
    let il = audesys_ld_compiler::ld_compile(ld_src).unwrap();
    let p = audesys_il_compiler::il_compile(&il).unwrap();
    let bytes = bincode::serialize(&p).unwrap();
    let (_t, mw) = build_inproc_stack();
    let e = Engine::new(Box::new(mw), Arc::new(LifecycleManager::new()));
    e.load_hal_program(&bytes).unwrap();
    e.register_signal(SignalDef::new("X1", HalPinType::Bool, HalValue::Bool(true), WriteStrategy::Own));
    e.register_signal(SignalDef::new("X2", HalPinType::Bool, HalValue::Bool(false), WriteStrategy::Own));
    e.register_signal(SignalDef::new("Y1", HalPinType::Bool, HalValue::Bool(false), WriteStrategy::Own));
    let h = e.start_with_cycle(50);
    thread::sleep(Duration::from_millis(200));
    e.stop(); h.join().unwrap();
    let s = e.signal_snapshot();
    eprintln!("snapshot: {:?}", s);
    let y1 = s.iter().find(|(n,_)| n=="Y1").unwrap();
    assert_eq!(y1.1, HalValue::Bool(true), "SET latch: Y1 should be true");
}

#[test]
#[ignore = "VM-IL integration pending"]
fn test_il_program_execution_via_executor() {
    use audesys_hal_ir::Executor;
    // Test IL program directly via Executor (bypass Engine)
    let prog = audesys_il_compiler::il_compile("LD X1\nAND X2\nST Y1").unwrap();
    let mut executor = Executor::new(prog);
    // Set X1=true, X2=true in VM registers
    executor.vm_mut().write_signal("X1", HalValue::Bool(true));
    executor.vm_mut().write_signal("X2", HalValue::Bool(true));
    executor.run_to_halt();
    assert_eq!(executor.vm().read_signal("Y1"), Some(&HalValue::Bool(true)),
        "LD: X1(true) AND X2(true) → ST Y1 should be true");
}
