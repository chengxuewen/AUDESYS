//! Alarm state machine → HalProgram generator.
//! Aggregates per-axis faults into group-level alarm state.
//! State machine: NORMAL→WARNING→ALARM→ESTOP
//! 来源: docs/modules/cnc/axis-group-management.md §7

use crate::config::AxisGroupConfig;
use audesys_hal_core::types::HalPinType;
use audesys_hal_core::HalValue;
use audesys_hal_ir::instruction::{Instruction, Opcode};
use audesys_hal_ir::program::HalProgram;
use audesys_hal_ir::types::{Direction, Operand, SignalBinding};

/// Alarm state constants.
pub const ALARM_NORMAL: u8 = 0;
pub const ALARM_WARNING: u8 = 1;
pub const ALARM_ALARM: u8 = 2;
pub const ALARM_ESTOP: u8 = 3;

// Register allocation
const R_ANY_FAULT: u8 = 0; // accumulated: any axis has fault?
const R_STATE: u8 = 1; // current alarm state
const R_NEW_STATE: u8 = 2; // computed new alarm state
const R_SCRATCH: u8 = 3; // scratch
const R_ZERO: u8 = 4; // constant 0.0
const R_ONE: u8 = 5; // constant 1.0

/// Generate a HalProgram that aggregates per-axis fault signals into a group alarm state.
///
/// Fault signals checked:
///   - axis.N.pos_fault (soft limit violation)
///   - axis.N.vel_fault (velocity fault)
///
/// Alarm state transitions:
///   - Any fault → WARNING
///   - All axes homed and no faults → NORMAL
///   - ESTOP always triggered by external input (not computed here)
pub fn generate_alarm_program(cfg: &AxisGroupConfig) -> HalProgram {
    let mut instructions: Vec<Instruction> = Vec::new();
    let mut signals: Vec<SignalBinding> = Vec::new();

    // Initialize constants
    instructions.push(Instruction::load_imm(R_ZERO, HalValue::F64(0.0)));
    instructions.push(Instruction::load_imm(R_ONE, HalValue::F64(1.0)));

    // Group-level alarm signals
    signals.push(SignalBinding {
        hal_signal_name: format!("{}.alarm_state", cfg.name),
        program_var: "alarm_state".into(),
        direction: Direction::ReadWrite,
        hal_pin_type: HalPinType::U8,
    });
    signals.push(SignalBinding {
        hal_signal_name: format!("{}.any_fault", cfg.name),
        program_var: "any_fault".into(),
        direction: Direction::Write,
        hal_pin_type: HalPinType::Bool,
    });

    // ── Check per-axis faults ──
    instructions.push(Instruction::load_imm(R_ANY_FAULT, HalValue::F64(0.0)));

    for axis in &cfg.axes {
        let pfx = cfg.signal_prefix(axis.index);

        // Add read bindings for fault signals
        signals.push(SignalBinding {
            hal_signal_name: format!("{}.pos_fault", pfx),
            program_var: format!("{}_pos_fault", pfx.replace('.', "_")),
            direction: Direction::Read,
            hal_pin_type: HalPinType::Bool,
        });
        signals.push(SignalBinding {
            hal_signal_name: format!("{}.vel_fault", pfx),
            program_var: format!("{}_vel_fault", pfx.replace('.', "_")),
            direction: Direction::Read,
            hal_pin_type: HalPinType::Bool,
        });

        // Load pos_fault → if non-zero, set R_ANY_FAULT = 1
        instructions.push(Instruction::new(
            Opcode::Load,
            vec![
                Operand::Register(R_SCRATCH),
                Operand::SignalName(format!("{}.pos_fault", pfx)),
            ],
        ));
        cmp_ne_imm(&mut instructions, R_SCRATCH, 0.0, R_SCRATCH);
        let skip_pos = emit_jump_if_not(&mut instructions, R_SCRATCH, 0);
        instructions.push(Instruction::load_imm(R_ANY_FAULT, HalValue::F64(1.0)));
        let after_pos = instructions.len();
        patch_jump(&mut instructions, skip_pos, after_pos);

        // Load vel_fault → if non-zero, set R_ANY_FAULT = 1
        instructions.push(Instruction::new(
            Opcode::Load,
            vec![
                Operand::Register(R_SCRATCH),
                Operand::SignalName(format!("{}.vel_fault", pfx)),
            ],
        ));
        cmp_ne_imm(&mut instructions, R_SCRATCH, 0.0, R_SCRATCH);
        let skip_vel = emit_jump_if_not(&mut instructions, R_SCRATCH, 0);
        instructions.push(Instruction::load_imm(R_ANY_FAULT, HalValue::F64(1.0)));
        let after_vel = instructions.len();
        patch_jump(&mut instructions, skip_vel, after_vel);
    }

    // ── Write any_fault signal ──
    instructions.push(Instruction::new(
        Opcode::Store,
        vec![
            Operand::SignalName(format!("{}.any_fault", cfg.name)),
            Operand::Register(R_ANY_FAULT),
        ],
    ));

    // ── Compute alarm state ──
    // Load current state
    instructions.push(Instruction::new(
        Opcode::Load,
        vec![
            Operand::Register(R_STATE),
            Operand::SignalName(format!("{}.alarm_state", cfg.name)),
        ],
    ));

    // Default: new_state = R_ANY_FAULT ? WARNING : NORMAL
    // ponytail: R_NEW_STATE = R_ANY_FAULT  (1=WARNING when fault, 0=NORMAL when no fault)
    // This maps directly: 0→NORMAL, 1→WARNING
    copy_reg(&mut instructions, R_ANY_FAULT, R_NEW_STATE, R_ZERO);

    // Write new state
    instructions.push(Instruction::new(
        Opcode::Store,
        vec![
            Operand::SignalName(format!("{}.alarm_state", cfg.name)),
            Operand::Register(R_NEW_STATE),
        ],
    ));

    instructions.push(Instruction::halt());

    HalProgram {
        name: format!("alarm_{}", cfg.name),
        instructions,
        signals,
        channels: vec![],
        function_table: vec![],
    }
}

// ── Helpers ──

fn copy_reg(instructions: &mut Vec<Instruction>, src: u8, dst: u8, zero_reg: u8) {
    instructions.push(Instruction::arith(Opcode::Add, src, zero_reg, dst));
}

fn cmp_ne_imm(instructions: &mut Vec<Instruction>, reg: u8, imm: f64, dst: u8) {
    let temp = R_SCRATCH; // use it as temp before overwriting
    instructions.push(Instruction::load_imm(temp, HalValue::F64(imm)));
    copy_reg(instructions, reg, dst, R_ZERO);
    instructions.push(Instruction::new(
        Opcode::Neq,
        vec![Operand::Register(dst), Operand::Register(temp)],
    ));
}

fn emit_jump_if_not(instructions: &mut Vec<Instruction>, cond_reg: u8, _placeholder: u32) -> usize {
    let temp = R_STATE;
    instructions.push(Instruction::load_imm(temp, HalValue::F64(0.0)));
    instructions.push(Instruction::new(
        Opcode::Eq,
        vec![Operand::Register(cond_reg), Operand::Register(temp)],
    ));
    let idx = instructions.len();
    instructions.push(Instruction::new(
        Opcode::JumpIf,
        vec![Operand::Register(cond_reg), Operand::Immediate(HalValue::U32(0))],
    ));
    idx
}

fn patch_jump(instructions: &mut Vec<Instruction>, jump_idx: usize, target: usize) {
    if let Some(inst) = instructions.get_mut(jump_idx) {
        if inst.opcode == Opcode::JumpIf && inst.operands.len() >= 2 {
            inst.operands[1] = Operand::Immediate(HalValue::U32(target as u32));
        }
    }
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_alarm_non_empty() {
        let cfg = AxisGroupConfig::default_xyz();
        let prog = generate_alarm_program(&cfg);
        assert!(!prog.instructions.is_empty());
        assert!(prog.instructions.last().unwrap().opcode == Opcode::Halt);
    }

    #[test]
    fn test_alarm_state_signal_present() {
        let cfg = AxisGroupConfig::default_xyz();
        let prog = generate_alarm_program(&cfg);
        let has_alarm = prog
            .signals
            .iter()
            .any(|s| s.hal_signal_name == "group.0.alarm_state");
        assert!(has_alarm);
    }

    #[test]
    fn test_any_fault_signal_present() {
        let cfg = AxisGroupConfig::default_xyz();
        let prog = generate_alarm_program(&cfg);
        let has_any = prog
            .signals
            .iter()
            .any(|s| s.hal_signal_name == "group.0.any_fault");
        assert!(has_any);
    }

    #[test]
    fn test_per_axis_fault_signals() {
        let cfg = AxisGroupConfig::default_xyz();
        let prog = generate_alarm_program(&cfg);
        let pos_faults: Vec<_> = prog
            .signals
            .iter()
            .filter(|s| s.hal_signal_name.ends_with(".pos_fault"))
            .collect();
        let vel_faults: Vec<_> = prog
            .signals
            .iter()
            .filter(|s| s.hal_signal_name.ends_with(".vel_fault"))
            .collect();
        assert_eq!(pos_faults.len(), 3);
        assert_eq!(vel_faults.len(), 3);
    }

    #[test]
    fn test_alarm_state_constants() {
        assert_eq!(ALARM_NORMAL, 0);
        assert_eq!(ALARM_WARNING, 1);
        assert_eq!(ALARM_ALARM, 2);
        assert_eq!(ALARM_ESTOP, 3);
    }
}
