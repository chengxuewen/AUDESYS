//! Soft limit enforcement → HalProgram generator.
//! Per-cycle check: if axis is homed and pos_cmd exceeds limits → clamp + set fault.
//! 来源: docs/modules/cnc/axis-group-management.md §5

use crate::config::AxisGroupConfig;
use audesys_hal_core::types::HalPinType;
use audesys_hal_core::HalValue;
use audesys_hal_ir::instruction::{Instruction, Opcode};
use audesys_hal_ir::program::HalProgram;
use audesys_hal_ir::types::{Direction, Operand, SignalBinding};

// Register allocation
const R_POS: u8 = 0; // axis pos_cmd
const R_HOMED: u8 = 1; // homed flag
const R_MIN: u8 = 2; // soft_limit_min
const R_MAX: u8 = 3; // soft_limit_max
const R_FAULT: u8 = 4; // fault flag (1 = fault)
const R_SCRATCH: u8 = 5; // scratch
const R_ZERO: u8 = 6; // constant 0.0
const R_ONE: u8 = 7; // constant 1.0

/// Generate a HalProgram that enforces soft limits for all axes in the group.
///
/// For each axis, checks: if homed && (pos_cmd < min || pos_cmd > max) → clamp pos_cmd,
/// set axis.N.pos_fault signal.
pub fn generate_soft_limits_program(cfg: &AxisGroupConfig) -> HalProgram {
    let mut instructions: Vec<Instruction> = Vec::new();
    let mut signals: Vec<SignalBinding> = Vec::new();

    // Initialize constants
    instructions.push(Instruction::load_imm(R_ZERO, HalValue::F64(0.0)));
    instructions.push(Instruction::load_imm(R_ONE, HalValue::F64(1.0)));

    for axis in &cfg.axes {
        if !axis.soft_limit_enable {
            continue;
        }
        let pfx = cfg.signal_prefix(axis.index);

        // Add signal bindings
        signals.push(SignalBinding {
            hal_signal_name: format!("{}.pos_cmd", pfx),
            program_var: format!("{}_pos_cmd", pfx.replace('.', "_")),
            direction: Direction::ReadWrite,
            hal_pin_type: HalPinType::F64,
        });
        signals.push(SignalBinding {
            hal_signal_name: format!("{}.homed", pfx),
            program_var: format!("{}_homed", pfx.replace('.', "_")),
            direction: Direction::Read,
            hal_pin_type: HalPinType::Bool,
        });
        signals.push(SignalBinding {
            hal_signal_name: format!("{}.pos_fault", pfx),
            program_var: format!("{}_pos_fault", pfx.replace('.', "_")),
            direction: Direction::Write,
            hal_pin_type: HalPinType::Bool,
        });

        // ── Load pos_cmd ──
        instructions.push(Instruction::new(
            Opcode::Load,
            vec![
                Operand::Register(R_POS),
                Operand::SignalName(format!("{}.pos_cmd", pfx)),
            ],
        ));

        // ── Load homed flag ──
        instructions.push(Instruction::new(
            Opcode::Load,
            vec![
                Operand::Register(R_HOMED),
                Operand::SignalName(format!("{}.homed", pfx)),
            ],
        ));

        // ── If not homed, skip limit checks ──
        // R_HOMED = (R_HOMED == 1) ? 1 : 0 → if 1, homed
        copy_reg(&mut instructions, R_HOMED, R_SCRATCH, R_ZERO);
        cmp_eq_imm(&mut instructions, R_SCRATCH, 1.0);
        let skip_idx = emit_jump_if_not(&mut instructions, R_SCRATCH, 0);

        // ── Check lower bound ──
        // R_FAULT = 0 initially
        instructions.push(Instruction::load_imm(R_FAULT, HalValue::F64(0.0)));

        instructions.push(Instruction::load_imm(R_MIN, HalValue::F64(axis.soft_limit_min)));
        // if pos < min: clamp to min, R_FAULT = 1
        cmp_lt(&mut instructions, R_POS, R_MIN, R_SCRATCH); // R_SCRATCH = (pos < min) ? 1 : 0
        let no_lower_fault = emit_jump_if_not(&mut instructions, R_SCRATCH, 0);
        // clamp pos to min
        copy_reg(&mut instructions, R_MIN, R_POS, R_ZERO);
        instructions.push(Instruction::load_imm(R_FAULT, HalValue::F64(1.0)));
        let after_lower = instructions.len();
        patch_jump(&mut instructions, no_lower_fault, after_lower);

        // ── Check upper bound ──
        instructions.push(Instruction::load_imm(R_MAX, HalValue::F64(axis.soft_limit_max)));
        cmp_gt(&mut instructions, R_POS, R_MAX, R_SCRATCH); // R_SCRATCH = (pos > max) ? 1 : 0
        let no_upper_fault = emit_jump_if_not(&mut instructions, R_SCRATCH, 0);
        // clamp pos to max
        copy_reg(&mut instructions, R_MAX, R_POS, R_ZERO);
        instructions.push(Instruction::load_imm(R_FAULT, HalValue::F64(1.0)));
        let after_upper = instructions.len();
        patch_jump(&mut instructions, no_upper_fault, after_upper);

        // ── Write pos_fault signal ──
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                Operand::SignalName(format!("{}.pos_fault", pfx)),
                Operand::Register(R_FAULT),
            ],
        ));

        // ── Write clamped pos_cmd back ──
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                Operand::SignalName(format!("{}.pos_cmd", pfx)),
                Operand::Register(R_POS),
            ],
        ));

        // Patch skip to after this axis block
        let after_axis = instructions.len();
        patch_jump(&mut instructions, skip_idx, after_axis);
    }

    instructions.push(Instruction::halt());

    HalProgram {
        name: format!("soft_limits_{}", cfg.name),
        instructions,
        signals,
        channels: vec![],
        function_table: vec![],
    }
}

/// Copy src → dst via `dst = src + 0`
fn copy_reg(instructions: &mut Vec<Instruction>, src: u8, dst: u8, zero_reg: u8) {
    instructions.push(Instruction::arith(Opcode::Add, src, zero_reg, dst));
}

/// Compare r with immediate: r = (r == imm) ? 1.0 : 0.0
fn cmp_eq_imm(instructions: &mut Vec<Instruction>, reg: u8, imm: f64) {
    let temp = R_MAX; // borrow R_MAX temporarily
    instructions.push(Instruction::load_imm(temp, HalValue::F64(imm)));
    instructions.push(Instruction::new(
        Opcode::Eq,
        vec![Operand::Register(reg), Operand::Register(temp)],
    ));
}

/// Compare a < b: dst = (a < b) ? 1.0 : 0.0
fn cmp_lt(instructions: &mut Vec<Instruction>, a: u8, b: u8, dst: u8) {
    // copy a to dst, then Lt(dst, b) → dst = (a < b) ? 1 : 0
    copy_reg(instructions, a, dst, R_ZERO);
    instructions.push(Instruction::new(
        Opcode::Lt,
        vec![Operand::Register(dst), Operand::Register(b)],
    ));
}

/// Compare a > b: dst = (a > b) ? 1.0 : 0.0
fn cmp_gt(instructions: &mut Vec<Instruction>, a: u8, b: u8, dst: u8) {
    copy_reg(instructions, a, dst, R_ZERO);
    instructions.push(Instruction::new(
        Opcode::Gt,
        vec![Operand::Register(dst), Operand::Register(b)],
    ));
}

/// Emit JumpIf that skips when condition reg == 0.
/// Returns instruction index for later patching.
fn emit_jump_if_not(instructions: &mut Vec<Instruction>, cond_reg: u8, _placeholder: u32) -> usize {
    // Invert: cond_reg = (cond_reg == 0) ? 1 : 0
    cmp_eq_imm(instructions, cond_reg, 0.0);
    let idx = instructions.len();
    instructions.push(Instruction::new(
        Opcode::JumpIf,
        vec![Operand::Register(cond_reg), Operand::Immediate(HalValue::U32(0))],
    ));
    idx
}

/// Patch a JumpIf target.
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
    fn test_generate_soft_limits_non_empty() {
        let cfg = AxisGroupConfig::default_xyz();
        let prog = generate_soft_limits_program(&cfg);
        assert!(!prog.instructions.is_empty());
        assert!(prog.instructions.last().unwrap().opcode == Opcode::Halt);
    }

    #[test]
    fn test_pos_fault_signals_present() {
        let cfg = AxisGroupConfig::default_xyz();
        let prog = generate_soft_limits_program(&cfg);
        let fault_signals: Vec<_> = prog
            .signals
            .iter()
            .filter(|s| s.hal_signal_name.ends_with(".pos_fault"))
            .collect();
        assert_eq!(fault_signals.len(), 3);
    }

    #[test]
    fn test_disabled_limits_skipped() {
        let mut cfg = AxisGroupConfig::default_xyz();
        cfg.axes[0].soft_limit_enable = false;
        cfg.axes[1].soft_limit_enable = false;
        // Only Z axis has soft limits enabled
        let prog = generate_soft_limits_program(&cfg);
        let fault_signals: Vec<_> = prog
            .signals
            .iter()
            .filter(|s| s.hal_signal_name.ends_with(".pos_fault"))
            .collect();
        assert_eq!(fault_signals.len(), 1);
        assert!(fault_signals[0].hal_signal_name.contains("axis.2"));
    }

    #[test]
    fn test_single_axis_limits() {
        let cfg = AxisGroupConfig::new(
            "group.0",
            vec![crate::config::AxisConfig::linear(0, "X")],
        );
        let prog = generate_soft_limits_program(&cfg);
        assert_eq!(
            prog.signals
                .iter()
                .filter(|s| s.hal_signal_name.ends_with(".pos_fault"))
                .count(),
            1
        );
    }
}
