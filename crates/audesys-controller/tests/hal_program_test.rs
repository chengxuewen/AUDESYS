//! Integration test: HAL IR program loading and execution in Engine cycle.
//!
//! Verifies that a compiled ST program (bincode-serialized HalProgram) can be
//! loaded into the Engine, and the VM executor runs in each COMPUTE phase,
//! writing register outputs to signals.
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use audesys_amw_inproc::{
    InprocAuditLog, InprocMiddleware, InprocQoS, InprocTransport, StaticDiscovery,
};
use audesys_controller::{Engine, LifecycleManager, SignalDef, WriteStrategy};
use audesys_hal_core::HalPinType;
use audesys_hal_core::HalValue;
use audesys_hal_ir::instruction::{Instruction, Opcode};
use audesys_hal_ir::program::HalProgram;
use audesys_hal_ir::types::Operand;

mod common;
use common::build_inproc_stack;

// ── tests ──
// ── tests ──

#[test]
fn test_load_and_execute_hal_program_in_cycle() {
    let (_transport, mw) = build_inproc_stack();
    let lifecycle = Arc::new(LifecycleManager::new());
    let engine = Engine::new(Box::new(mw), Arc::clone(&lifecycle));

    // Create a simple program: load 42 into register 0, then halt
    let program = HalProgram::new(
        "test_prog".to_string(),
        vec![
            Instruction::load_imm(0, HalValue::S32(42)),
            Instruction::new(
                Opcode::Store,
                vec![Operand::SignalName("hal_output".into()), Operand::Register(0)],
            ),
            Instruction::halt(),
        ],
    );
    let bytes = bincode::serialize(&program).unwrap();
    engine.load_hal_program(&bytes).unwrap();

    // Register the output signal
    engine
        .register_signal(SignalDef::new(
            "hal_output",
            HalPinType::S32,
            HalValue::S32(0),
            WriteStrategy::Own,
        ))
        .unwrap();

    // Start engine with short cycle
    let handle = engine.start_with_cycle(50);
    thread::sleep(Duration::from_millis(200));
    engine.stop();
    handle.join().unwrap();

    // Check that the output signal was updated
    let snapshot = engine.signal_snapshot();
    let output = snapshot.iter().find(|(name, _)| name == "hal_output");
    assert!(output.is_some(), "hal_output signal not found");
    assert_eq!(output.unwrap().1, HalValue::S32(42));
}
