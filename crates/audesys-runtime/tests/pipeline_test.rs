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
    let snapshot = engine.signal_snapshot(); eprintln!("snapshot keys: {:?}", snapshot.iter().map(|(n,_)| n).collect::<Vec<_>>());
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
    let snapshot = engine.signal_snapshot(); eprintln!("snapshot keys: {:?}", snapshot.iter().map(|(n,_)| n).collect::<Vec<_>>());
    assert!(!snapshot.is_empty());
    assert!(snapshot.iter().any(|(name, _)| name == "result"));
}

// ── IL pipeline test (direct Executor) ──

#[test]
fn test_il_program_execution_via_executor() { 
    let prog = audesys_il_compiler::il_compile("LD X1\nST Y1").unwrap();
    let mut exec = Executor::new(prog);
    exec.vm_mut().write_signal("X1", HalValue::Bool(true));
    exec.vm_mut().write_signal("X2", HalValue::Bool(true));
// debug removed
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

#[test]
fn test_ld_pipeline_basic() {
    let ld_src = "NETWORK\n  NO X1\n  NO X2\n  OUT Y1";
    let il = audesys_ld_compiler::ld_compile(ld_src).unwrap();
    let prog = audesys_il_compiler::il_compile(&il).unwrap();
    let mut exec = Executor::new(prog);
    exec.vm_mut().write_signal("X1", HalValue::Bool(true));
    exec.vm_mut().write_signal("X2", HalValue::Bool(true));
    exec.run_to_halt();
    assert_eq!(exec.vm().read_signal("Y1"), Some(&HalValue::Bool(true)));
}

#[test]
fn test_ld_pipeline_nc() {
    let ld_src = "NETWORK\n  NC X1\n  OUT Y1";
    let il = audesys_ld_compiler::ld_compile(ld_src).unwrap();
    let prog = audesys_il_compiler::il_compile(&il).unwrap();
    let mut exec = Executor::new(prog);
    exec.vm_mut().write_signal("X1", HalValue::Bool(false));
    exec.run_to_halt();
    assert_eq!(exec.vm().read_signal("Y1"), Some(&HalValue::Bool(true)));
}

#[test]
fn test_ld_deploy_and_execute() {
    use audesys_amw_inproc::{InprocAuditLog, InprocMiddleware, InprocQoS, InprocTransport, StaticDiscovery};
    use audesys_runtime::{Engine, LifecycleManager, SignalDef, WriteStrategy};
    use audesys_hal_core::{HalPinType, HalValue};
    use std::sync::Arc;
    use std::thread;
    use std::time::Duration;
    
    // 1. LD source → compile
    let ld_src = "NETWORK\n  NO START_BTN\n  NC ESTOP\n  OUT MOTOR_RUN";
    let il = audesys_ld_compiler::ld_compile(ld_src).unwrap();
    let prog = audesys_il_compiler::il_compile(&il).unwrap();
    let bytes = bincode::serialize(&prog).unwrap();
    
    // 2. Set up Runtime engine with inproc
    let (_t, mw) = common::build_inproc_stack();
    let engine = Engine::new(Box::new(mw), Arc::new(LifecycleManager::new()));
    
    // 3. Deploy (load_hal_program auto-registers signals from program.signals)
    engine.load_hal_program(&bytes).unwrap();
    
    // 4. Set input signal values
    let _ = engine.register_signal(SignalDef::new("START_BTN", HalPinType::Bool, HalValue::Bool(true), WriteStrategy::Own));
    let _ = engine.register_signal(SignalDef::new("ESTOP", HalPinType::Bool, HalValue::Bool(false), WriteStrategy::Own));
    let _ = engine.register_signal(SignalDef::new("MOTOR_RUN", HalPinType::Bool, HalValue::Bool(false), WriteStrategy::Own));
    
    // 5. Run engine
    let h = engine.start_with_cycle(50);
    thread::sleep(Duration::from_millis(200));
    engine.stop(); h.join().unwrap();
    
    // 6. Verify: START_BTN(true) AND NOT(ESTOP=false) → MOTOR_RUN=true
    let snapshot = engine.signal_snapshot();
    assert!(snapshot.len() >= 3, "expected >=3 signals, got {}", snapshot.len());
    let motor = snapshot.iter().find(|(n,_)| n=="MOTOR_RUN");
    assert!(motor.is_some(), "MOTOR_RUN not found in snapshot");
    assert_eq!(motor.unwrap().1, HalValue::Bool(true), "LD: START_BTN AND NOT(ESTOP) → MOTOR_RUN=true");
}
