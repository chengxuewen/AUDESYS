//! Backlash compensation → HalProgram generator.
//! Track last direction, detect reversal, apply compensation in one cycle.
//! 来源: docs/modules/cnc/axis-group-management.md §6

use crate::config::AxisGroupConfig;
use audesys_hal_core::types::HalPinType;
use audesys_hal_core::HalValue;
use audesys_hal_ir::instruction::{Instruction, Opcode};
use audesys_hal_ir::program::HalProgram;
use audesys_hal_ir::types::{Direction, Operand, SignalBinding};

// Register allocation
const R_POS: u8 = 0; // axis pos_cmd
const R_VEL: u8 = 1; // axis vel_cmd (to determine direction)
const R_LAST_DIR: u8 = 2; // last_direction (+1/-1/0)
const R_NEW_DIR: u8 = 3; // new direction (sign of vel_cmd)
const R_BACKLASH: u8 = 4; // backlash distance
const R_COMP: u8 = 5; // compensation amount (scratch)
const R_SCRATCH: u8 = 6; // scratch
const R_ZERO: u8 = 7; // constant 0.0
const R_ONE: u8 = 8; // constant 1.0

/// Generate a HalProgram that applies backlash compensation per cycle.
///
/// For each axis: track velocity direction, detect reversal (new_dir != 0 && new_dir != last_dir),
/// apply backlash compensation to pos_cmd.
pub fn generate_backlash_program(cfg: &AxisGroupConfig) -> HalProgram {
    let mut instructions: Vec<Instruction> = Vec::new();
    let mut signals: Vec<SignalBinding> = Vec::new();

    instructions.push(Instruction::load_imm(R_ZERO, HalValue::F64(0.0)));
    instructions.push(Instruction::load_imm(R_ONE, HalValue::F64(1.0)));

    for axis in &cfg.axes {
        if !axis.backlash_enable || axis.backlash_distance == 0.0 {
            continue;
        }
        let pfx = cfg.signal_prefix(axis.index);

        signals.push(SignalBinding {
            hal_signal_name: format!("{}.pos_cmd", pfx),
            program_var: format!("{}_pos_cmd", pfx.replace('.', "_")),
            direction: Direction::ReadWrite,
            hal_pin_type: HalPinType::F64,
        });
        signals.push(SignalBinding {
            hal_signal_name: format!("{}.vel_cmd", pfx),
            program_var: format!("{}_vel_cmd", pfx.replace('.', "_")),
            direction: Direction::Read,
            hal_pin_type: HalPinType::F64,
        });
        signals.push(SignalBinding {
            hal_signal_name: format!("{}.last_dir", pfx),
            program_var: format!("{}_last_dir", pfx.replace('.', "_")),
            direction: Direction::ReadWrite,
            hal_pin_type: HalPinType::F64,
        });

        // ── Load pos_cmd ──
        instructions.push(Instruction::new(
            Opcode::Load,
            vec![
                Operand::Register(R_POS),
                Operand::SignalName(format!("{}.pos_cmd", pfx)),
            ],
        ));

        // ── Load vel_cmd, determine new direction ──
        instructions.push(Instruction::new(
            Opcode::Load,
            vec![
                Operand::Register(R_VEL),
                Operand::SignalName(format!("{}.vel_cmd", pfx)),
            ],
        ));

        // ── Load last_dir ──
        instructions.push(Instruction::new(
            Opcode::Load,
            vec![
                Operand::Register(R_LAST_DIR),
                Operand::SignalName(format!("{}.last_dir", pfx)),
            ],
        ));

        // ── Compute new direction: new_dir = sign(vel) ──
        // ponytail: sign via compare with zero
        // new_dir = (vel > 0) ? 1 : ((vel < 0) ? -1 : 0)
        instructions.push(Instruction::load_imm(R_NEW_DIR, HalValue::F64(0.0)));
        // if vel > 0 → new_dir = 1
        cmp_gt(&mut instructions, R_VEL, R_ZERO, R_SCRATCH);
        let not_pos = emit_jump_if_not(&mut instructions, R_SCRATCH, 0);
        instructions.push(Instruction::load_imm(R_NEW_DIR, HalValue::F64(1.0)));
        let done_sign = emit_jump(&mut instructions, 0);
        let after_pos = instructions.len();
        patch_jump(&mut instructions, not_pos, after_pos);
        // if vel < 0 → new_dir = -1
        cmp_lt(&mut instructions, R_VEL, R_ZERO, R_SCRATCH);
        let not_neg = emit_jump_if_not(&mut instructions, R_SCRATCH, 0);
        instructions.push(Instruction::load_imm(R_NEW_DIR, HalValue::F64(-1.0)));
        let after_neg = instructions.len();
        patch_jump(&mut instructions, not_neg, after_neg);
        // if vel == 0 → new_dir stays 0
        patch_jump(&mut instructions, done_sign, after_neg);

        // ── Detect reversal: new_dir != 0 && new_dir != last_dir ──
        // R_SCRATCH = (new_dir != 0) ? 1 : 0
        cmp_ne_imm(&mut instructions, R_NEW_DIR, 0.0, R_SCRATCH);
        let no_reversal = emit_jump_if_not(&mut instructions, R_SCRATCH, 0);

        // R_SCRATCH = (new_dir != last_dir) ? 1 : 0
        copy_reg(&mut instructions, R_NEW_DIR, R_SCRATCH, R_ZERO);
        instructions.push(Instruction::new(
            Opcode::Neq,
            vec![Operand::Register(R_SCRATCH), Operand::Register(R_LAST_DIR)],
        ));
        let no_reversal2 = emit_jump_if_not(&mut instructions, R_SCRATCH, 0);

        // ── Apply backlash compensation ──
        instructions.push(Instruction::load_imm(
            R_BACKLASH,
            HalValue::F64(axis.backlash_distance),
        ));
        // compensation = backlash * new_dir (apply in direction of new movement)
        instructions.push(Instruction::arith(Opcode::Mul, R_BACKLASH, R_NEW_DIR, R_COMP));
        // pos_cmd = pos_cmd + compensation
        instructions.push(Instruction::arith(Opcode::Add, R_POS, R_COMP, R_POS));

        let after_comp = instructions.len();
        patch_jump(&mut instructions, no_reversal2, after_comp);
        patch_jump(&mut instructions, no_reversal, after_comp);

        // ── Update last_dir = new_dir ──
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                Operand::SignalName(format!("{}.last_dir", pfx)),
                Operand::Register(R_NEW_DIR),
            ],
        ));

        // ── Write updated pos_cmd ──
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                Operand::SignalName(format!("{}.pos_cmd", pfx)),
                Operand::Register(R_POS),
            ],
        ));
    }

    instructions.push(Instruction::halt());

    HalProgram {
        name: format!("backlash_{}", cfg.name),
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

fn cmp_gt(instructions: &mut Vec<Instruction>, a: u8, b: u8, dst: u8) {
    copy_reg(instructions, a, dst, R_ZERO);
    instructions.push(Instruction::new(
        Opcode::Gt,
        vec![Operand::Register(dst), Operand::Register(b)],
    ));
}

fn cmp_lt(instructions: &mut Vec<Instruction>, a: u8, b: u8, dst: u8) {
    copy_reg(instructions, a, dst, R_ZERO);
    instructions.push(Instruction::new(
        Opcode::Lt,
        vec![Operand::Register(dst), Operand::Register(b)],
    ));
}

fn cmp_ne_imm(instructions: &mut Vec<Instruction>, reg: u8, imm: f64, dst: u8) {
    let temp = R_BACKLASH; // borrow
    instructions.push(Instruction::load_imm(temp, HalValue::F64(imm)));
    copy_reg(instructions, reg, dst, R_ZERO);
    instructions.push(Instruction::new(
        Opcode::Neq,
        vec![Operand::Register(dst), Operand::Register(temp)],
    ));
}

fn emit_jump_if_not(instructions: &mut Vec<Instruction>, cond_reg: u8, _placeholder: u32) -> usize {
    // Invert: compare with 0
    let temp = R_BACKLASH;
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

fn emit_jump(instructions: &mut Vec<Instruction>, _placeholder: u32) -> usize {
    let idx = instructions.len();
    instructions.push(Instruction::jump(0));
    idx
}

fn patch_jump(instructions: &mut Vec<Instruction>, jump_idx: usize, target: usize) {
    if let Some(inst) = instructions.get_mut(jump_idx) {
        match inst.opcode {
            Opcode::Jump => {
                if !inst.operands.is_empty() {
                    inst.operands[0] = Operand::Immediate(HalValue::U32(target as u32));
                }
            }
            Opcode::JumpIf => {
                if inst.operands.len() >= 2 {
                    inst.operands[1] = Operand::Immediate(HalValue::U32(target as u32));
                }
            }
            _ => {}
        }
    }
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::AxisConfig;

    #[test]
    fn test_generate_backlash_non_empty() {
        let mut axis = AxisConfig::linear(0, "X");
        axis.backlash_enable = true;
        axis.backlash_distance = 0.05;
        let cfg = AxisGroupConfig::new("group.0", vec![axis]);
        let prog = generate_backlash_program(&cfg);
        assert!(!prog.instructions.is_empty());
        assert!(prog.instructions.last().unwrap().opcode == Opcode::Halt);
    }

    #[test]
    fn test_backlash_disabled_skipped() {
        let cfg = AxisGroupConfig::default_xyz(); // backlash disabled by default
        let prog = generate_backlash_program(&cfg);
        // Only constants + halt
        assert!(
            prog.instructions.len() <= 3,
            "backlash disabled should emit minimal instructions"
        );
    }

    #[test]
    fn test_last_dir_signals_present() {
        let mut axis = AxisConfig::linear(0, "X");
        axis.backlash_enable = true;
        axis.backlash_distance = 0.01;
        let cfg = AxisGroupConfig::new("group.0", vec![axis]);
        let prog = generate_backlash_program(&cfg);
        let has_last_dir = prog
            .signals
            .iter()
            .any(|s| s.hal_signal_name.ends_with(".last_dir"));
        assert!(has_last_dir);
    }

    #[test]
    fn test_backlash_zero_distance_skipped() {
        let mut axis = AxisConfig::linear(0, "X");
        axis.backlash_enable = true;
        axis.backlash_distance = 0.0; // zero → skip
        let cfg = AxisGroupConfig::new("group.0", vec![axis]);
        let prog = generate_backlash_program(&cfg);
        assert!(prog.instructions.len() <= 3);
    }
}
