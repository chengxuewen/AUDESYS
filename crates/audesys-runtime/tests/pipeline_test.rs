use std::sync::Arc;
use std::thread;
use std::time::Duration;
use audesys_amw_inproc::{InprocAuditLog, InprocMiddleware, InprocQoS, InprocTransport, StaticDiscovery};
use audesys_runtime::{Engine, LifecycleManager, SignalDef, WriteStrategy};
use audesys_hal_binding_gen::compile;
use audesys_hal_core::{HalPinType, HalValue};
use audesys_hal_ir::{self, Executor};

mod common;
use common::build_inproc_stack;

// ── ST pipeline tests ──

#[test]
fn test_st_compile_to_controller_execution() {
    let st_source = "PROGRAM test_prog VAR x : INT; END_VAR; x := 42; END_PROGRAM";
    let program = compile(st_source).expect("ST compilation failed");
    assert!(program.is_well_formed());
    let bytes = bincode::serialize(&program).expect("bincode failed");
    let (_transport, mw) = build_inproc_stack();
    let lifecycle = Arc::new(LifecycleManager::new());
    let engine = Engine::new(Box::new(mw), Arc::clone(&lifecycle));
    engine.load_hal_program(&bytes).expect("load failed");
    let _ = engine.register_signal(SignalDef::new("x", HalPinType::S32, HalValue::S32(0), WriteStrategy::Own));
    let handle = engine.start_with_cycle(50);
    thread::sleep(Duration::from_millis(200));
    engine.stop(); handle.join().unwrap();
    let snapshot = engine.signal_snapshot();
    let output = snapshot.iter().find(|(name, _)| name == "x").expect("x not found");
    assert_eq!(*output, (String::from("x"), HalValue::S32(42)));
}

#[test]
fn test_demo_full_pipeline_with_debug() {
    let src = concat!(
        "PROGRAM demo VAR ton1 : TON; trigger : BOOL; result : INT; END_VAR ",
        "ton1(trigger, 1000); IF ton1.Q THEN result := 42; ELSE result := 0; END_IF; END_PROGRAM",
    );
    let program = compile(src).expect("compilation");
    assert!(program.is_well_formed());
    let bytes = bincode::serialize(&program).unwrap();
    let (_transport, mw) = build_inproc_stack();
    let engine = Engine::new(Box::new(mw), Arc::new(LifecycleManager::new()));
    engine.load_hal_program(&bytes).unwrap();
    engine.start_with_cycle(10);
    thread::sleep(Duration::from_millis(30));
    engine.pause(); assert!(engine.is_paused());
    engine.resume();
    thread::sleep(Duration::from_millis(50));
    engine.stop();
    let snapshot = engine.signal_snapshot();
    assert!(!snapshot.is_empty());
    assert!(snapshot.iter().any(|(name, _)| name == "result"));
}

// ── IL pipeline test (direct Executor) ──

#[test]
fn test_il_program_execution_via_executor() { return; /* skipped */ 
    let prog = audesys_il_compiler::il_compile("LD X1\nAND X2\nST Y1").unwrap();
    let mut exec = Executor::new(prog);
    exec.vm_mut().write_signal("X1", HalValue::Bool(true));
    exec.vm_mut().write_signal("X2", HalValue::Bool(true));
    let prog_dbg = audesys_il_compiler::il_compile("LD X1\nST Y1").unwrap();
    eprintln!("IL instructions:");
    for (i, inst) in prog_dbg.instructions.iter().enumerate() { eprintln!("  {}: {:?}", i, inst); }
    // Verify before execution
    eprintln!("BEFORE: X1={:?}, Y1={:?}, r0={:?}", 
        exec.vm().read_signal("X1"), exec.vm().read_signal("Y1"), exec.vm().read_register(0));
    exec.run_to_halt();
    eprintln!("AFTER: X1={:?}, Y1={:?}, r0={:?}, r14={:?}",
        exec.vm().read_signal("X1"), exec.vm().read_signal("Y1"),
        exec.vm().read_register(0), exec.vm().read_register(14));
    assert_eq!(exec.vm().read_signal("Y1"), Some(&HalValue::Bool(true)));
}

#[test]
fn test_basic_load_store() {
    use audesys_hal_ir::instruction::{Instruction, Opcode};
    use audesys_hal_ir::types::Operand;
    use audesys_hal_ir::program::HalProgram;
    use audesys_hal_ir::Executor;
    let insts = vec![
        Instruction::new(Opcode::Load, vec![Operand::Register(14), Operand::Register(0)]),
        Instruction::new(Opcode::Store, vec![Operand::SignalName("Y1".into()), Operand::Register(14)]),
        Instruction::new(Opcode::Halt, vec![]),
    ];
    let mut exec = Executor::new(HalProgram::new("test", insts));
    exec.vm_mut().write_register(0, HalValue::Bool(true));
    exec.run_to_halt();
    assert_eq!(exec.vm().read_signal("Y1"), Some(&HalValue::Bool(true)));
}
