//! Homing state machine → HalProgram generator.
//! Generates per-axis SEEK→LATCH→BACKOFF→DONE sequences.
//! 来源: docs/modules/cnc/axis-group-management.md §4

use crate::config::{AxisGroupConfig, HomeDirection};
use audesys_hal_core::types::HalPinType;
use audesys_hal_core::HalValue;
use audesys_hal_ir::instruction::{Instruction, Opcode};
use audesys_hal_ir::program::HalProgram;
use audesys_hal_ir::types::{Direction, Operand, SignalBinding};

// Register allocation (ponytail: fixed, per-axis scratch)
const R_IDX: u8 = 0; // current axis index
const R_STATE: u8 = 1; // homing state (0=IDLE,1=SEEK,2=LATCH,3=BACKOFF,4=DONE)
const R_LIMIT: u8 = 2; // limit switch value (read from signal)
const R_VEL: u8 = 3; // velocity command value
const R_DIR: u8 = 4; // direction multiplier (±1)
const R_SCRATCH: u8 = 5; // scratch for comparison
const R_ZERO: u8 = 6; // constant 0.0
const R_ONE: u8 = 7; // constant 1.0

/// Homing state constants
const ST_IDLE: u8 = 0;
const ST_SEEK: u8 = 1;
const ST_LATCH: u8 = 2;
const ST_BACKOFF: u8 = 3;
const ST_DONE: u8 = 4;

/// Generate a HalProgram that performs sequential homing for all axes in the group.
///
/// Each cycle, the program checks the homing state of the current axis and advances
/// one FSM step if conditions are met. Axes are homed in order (0, 1, 2, ...).
pub fn generate_homing_program(cfg: &AxisGroupConfig) -> HalProgram {
    let mut instructions: Vec<Instruction> = Vec::new();
    let mut signals: Vec<SignalBinding> = Vec::new();

    // Initialize constants
    instructions.push(Instruction::load_imm(R_ZERO, HalValue::F64(0.0)));
    instructions.push(Instruction::load_imm(R_ONE, HalValue::F64(1.0)));

    // Add signal bindings for all axes
    for axis in &cfg.axes {
        let pfx = cfg.signal_prefix(axis.index);
        add_signal_bindings(&mut signals, &pfx);
    }

    // For each axis, generate homing FSM block
    for axis in &cfg.axes {
        let pfx = cfg.signal_prefix(axis.index);
        let dir_mult = axis.home_direction.multiplier();

        instructions.push(Instruction::load_imm(R_IDX, HalValue::U32(axis.index as u32)));

        // ── Load current homing state from signal ──
        instructions.push(Instruction::new(
            Opcode::Load,
            vec![
                Operand::Register(R_STATE),
                Operand::SignalName(format!("{}.homing_state", pfx)),
            ],
        ));

        // ── State dispatch ──
        // We generate complete state blocks for IDLE, SEEK, LATCH, BACKOFF, DONE.
        // Each non-matching state check jumps past its block.
        // We compute jump offsets manually by tracking instruction positions.

        let _jump_patches: Vec<(usize, usize)> = Vec::new(); // (jump_instr_idx, target_label_idx)

        // --- Check ST_IDLE ---
        let _idle_start = instructions.len();
        emit_copy(&mut instructions, R_STATE, R_SCRATCH, R_ZERO);
        emit_cmp_eq_imm(&mut instructions, R_SCRATCH, ST_IDLE as f64);
        // placeholder jump: if NOT IDLE, skip IDLE block
        let skip_idle_jump = emit_jump_if_not(&mut instructions, R_SCRATCH, 0);
        // IDLE block: start homing
        instructions.push(Instruction::load_imm(R_DIR, HalValue::F64(dir_mult)));
        instructions.push(Instruction::load_imm(R_VEL, HalValue::F64(axis.home_search_vel)));
        emit_set_state(&mut instructions, &pfx, ST_SEEK);
        emit_write_vel(&mut instructions, &pfx, R_VEL);
        // enable axis
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                Operand::SignalName(format!("{}.enable", pfx)),
                Operand::Register(R_ONE),
            ],
        ));
        // save pos_cmd = 0 to start position tracking
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                Operand::SignalName(format!("{}.pos_cmd", pfx)),
                Operand::Register(R_ZERO),
            ],
        ));
        let idle_end = instructions.len();
        // Patch the skip jump
        patch_jump(&mut instructions, skip_idle_jump, idle_end);

        // --- Check ST_SEEK ---
        let _seek_start = instructions.len();
        emit_copy(&mut instructions, R_STATE, R_SCRATCH, R_ZERO);
        emit_cmp_eq_imm(&mut instructions, R_SCRATCH, ST_SEEK as f64);
        let skip_seek_jump = emit_jump_if_not(&mut instructions, R_SCRATCH, 0);
        // SEEK block: read limit switch, check if triggered
        instructions.push(Instruction::new(
            Opcode::Load,
            vec![
                Operand::Register(R_LIMIT),
                Operand::SignalName(limit_signal_name(&pfx, axis.home_direction)),
            ],
        ));
        // if limit triggered (R_LIMIT == 1), advance to LATCH
        emit_cmp_eq_imm(&mut instructions, R_LIMIT, 1.0);
        let keep_seeking_jump = emit_jump_if_not(&mut instructions, R_LIMIT, 0);
        // limit hit → enter LATCH
        emit_set_state(&mut instructions, &pfx, ST_LATCH);
        // reverse direction for latch
        let neg_dir = -dir_mult;
        instructions.push(Instruction::load_imm(R_DIR, HalValue::F64(neg_dir)));
        instructions.push(Instruction::load_imm(R_VEL, HalValue::F64(axis.home_latch_vel)));
        emit_write_vel(&mut instructions, &pfx, R_VEL);
        let limit_hit_end = instructions.len();
        patch_jump(&mut instructions, keep_seeking_jump, limit_hit_end);
        // limit not yet hit: stay in SEEK (no state change, just let vel_cmd persist)
        let seek_end = instructions.len();
        patch_jump(&mut instructions, skip_seek_jump, seek_end);

        // --- Check ST_LATCH ---
        let _latch_start = instructions.len();
        emit_copy(&mut instructions, R_STATE, R_SCRATCH, R_ZERO);
        emit_cmp_eq_imm(&mut instructions, R_SCRATCH, ST_LATCH as f64);
        let skip_latch_jump = emit_jump_if_not(&mut instructions, R_SCRATCH, 0);
        // LATCH block: wait for limit to clear
        instructions.push(Instruction::new(
            Opcode::Load,
            vec![
                Operand::Register(R_LIMIT),
                Operand::SignalName(limit_signal_name(&pfx, axis.home_direction)),
            ],
        ));
        // if limit cleared (R_LIMIT == 0), advance to BACKOFF
        emit_cmp_eq_imm(&mut instructions, R_LIMIT, 0.0);
        let keep_latching_jump = emit_jump_if_not(&mut instructions, R_LIMIT, 0);
        // limit cleared → enter BACKOFF
        emit_set_state(&mut instructions, &pfx, ST_BACKOFF);
        // set pos_cmd = home_offset (backoff handled by current position)
        instructions.push(Instruction::load_imm(R_SCRATCH, HalValue::F64(axis.home_offset)));
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                Operand::SignalName(format!("{}.pos_cmd", pfx)),
                Operand::Register(R_SCRATCH),
            ],
        ));
        // zero velocity
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                Operand::SignalName(format!("{}.vel_cmd", pfx)),
                Operand::Register(R_ZERO),
            ],
        ));
        let latch_cleared_end = instructions.len();
        patch_jump(&mut instructions, keep_latching_jump, latch_cleared_end);
        let latch_end = instructions.len();
        patch_jump(&mut instructions, skip_latch_jump, latch_end);

        // --- Check ST_BACKOFF ---
        let _backoff_start = instructions.len();
        emit_copy(&mut instructions, R_STATE, R_SCRATCH, R_ZERO);
        emit_cmp_eq_imm(&mut instructions, R_SCRATCH, ST_BACKOFF as f64);
        let skip_backoff_jump = emit_jump_if_not(&mut instructions, R_SCRATCH, 0);
        // BACKOFF → DONE: set homed flag, disable axis
        emit_set_state(&mut instructions, &pfx, ST_DONE);
        // set axis.N.homed = true
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                Operand::SignalName(format!("{}.homed", pfx)),
                Operand::Register(R_ONE),
            ],
        ));
        // disable axis
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                Operand::SignalName(format!("{}.enable", pfx)),
                Operand::Register(R_ZERO),
            ],
        ));
        let backoff_end = instructions.len();
        patch_jump(&mut instructions, skip_backoff_jump, backoff_end);

        // --- Check ST_DONE ---
        // No action needed — axis already homed. Fall through to next axis.
        // We still emit the check to absorb the DONE state code path (no jump needed,
        // if state is DONE we just fall through since no more state transitions).
    }

    // ── Halt ──
    instructions.push(Instruction::halt());

    HalProgram {
        name: format!("homing_{}", cfg.name),
        instructions,
        signals,
        channels: vec![],
        function_table: vec![],
    }
}

/// Add all required signal bindings for an axis.
fn add_signal_bindings(signals: &mut Vec<SignalBinding>, prefix: &str) {
    let bindings = [
        ("homing_state", HalPinType::U8, Direction::ReadWrite),
        ("pos_cmd", HalPinType::F64, Direction::Write),
        ("vel_cmd", HalPinType::F64, Direction::Write),
        ("enable", HalPinType::Bool, Direction::Write),
        ("limit_pos", HalPinType::Bool, Direction::Read),
        ("limit_neg", HalPinType::Bool, Direction::Read),
        ("homed", HalPinType::Bool, Direction::Write),
    ];
    for (suffix, pin_type, dir) in &bindings {
        signals.push(SignalBinding {
            hal_signal_name: format!("{}.{}", prefix, suffix),
            program_var: format!("{}_{}", prefix.replace('.', "_"), suffix),
            direction: *dir,
            hal_pin_type: *pin_type,
        });
    }
}

/// Return the appropriate limit signal name based on home direction.
fn limit_signal_name(prefix: &str, dir: HomeDirection) -> String {
    match dir {
        HomeDirection::Positive => format!("{}.limit_pos", prefix),
        HomeDirection::Negative => format!("{}.limit_neg", prefix),
    }
}

/// Emit: set homing_state signal to `state`
fn emit_set_state(instructions: &mut Vec<Instruction>, prefix: &str, state: u8) {
    let state_reg = R_SCRATCH;
    instructions.push(Instruction::load_imm(
        state_reg,
        HalValue::U8(state),
    ));
    instructions.push(Instruction::new(
        Opcode::Store,
        vec![
            Operand::SignalName(format!("{}.homing_state", prefix)),
            Operand::Register(state_reg),
        ],
    ));
}

/// Emit: write vel_cmd signal from register
fn emit_write_vel(instructions: &mut Vec<Instruction>, prefix: &str, vel_reg: u8) {
    // vel_cmd = vel_reg * direction
    // ponytail: use Mul for sign handling
    instructions.push(Instruction::arith(Opcode::Mul, vel_reg, R_DIR, R_SCRATCH));
    instructions.push(Instruction::new(
        Opcode::Store,
        vec![
            Operand::SignalName(format!("{}.vel_cmd", prefix)),
            Operand::Register(R_SCRATCH),
        ],
    ));
}

/// Copy src register to dst using `dst = src + 0`
fn emit_copy(instructions: &mut Vec<Instruction>, src: u8, dst: u8, zero_reg: u8) {
    instructions.push(Instruction::arith(Opcode::Add, src, zero_reg, dst));
}

/// Compare register with immediate: r = (r == imm) ? 1.0 : 0.0
fn emit_cmp_eq_imm(instructions: &mut Vec<Instruction>, reg: u8, imm: f64) {
    // Load imm into temp, then compare
    // ponytail: we use REG_TEMP (R_LIMIT when not reading limits) = R_SCRATCH+1
    // But we don't want to corrupt R_LIMIT. Use Safe approach:
    // Load imm → R_VEL (borrow it temporarily), then Eq(reg, R_VEL)
    let temp = R_VEL;
    instructions.push(Instruction::load_imm(temp, HalValue::F64(imm)));
    instructions.push(Instruction::new(
        Opcode::Eq,
        vec![Operand::Register(reg), Operand::Register(temp)],
    ));
}

/// Emit a JumpIf that skips when condition is false (reg == 0).
/// Returns the index of the jump instruction (for later patching).
fn emit_jump_if_not(instructions: &mut Vec<Instruction>, cond_reg: u8, _placeholder: u32) -> usize {
    // JumpIf jumps when cond_reg != 0. If cond_reg == 0 (condition false),
    // we want to jump PAST the block. So we need to invert:
    // After Eq: reg = (reg == val) ? 1 : 0
    // If reg == 1, we WANT to execute the block (don't jump).
    // If reg == 0, we want to jump over the block.
    // So: invert the condition.
    // ponytail: use Xor with 1 to invert: R_SCRATCH = 1 xor condition
    // Actually: use JumpIf(R_SCRATCH, target) directly and invert.
    // Let's just use JumpIf with inverted condition.
    // Invert: load 1, Xor cond_reg with 1, store in cond_reg
    // cond_reg = 1 xor cond_reg → now 1 means "skip"
    instructions.push(Instruction::load_imm(R_DIR, HalValue::F64(1.0)));
    // ponytail: Xor only works on int types in HalValue. Use Eq with zero instead.
    // To invert: if cond_reg == 0, we want to jump. So compare cond_reg with 0:
    // Now cond_reg = (cond_reg == 0) ? 1 : 0
    // If cond_reg was 1 (match), now it's 0. If cond_reg was 0 (no match), now it's 1.
    // So now cond_reg=1 means "skip" → JumpIf jumps.
    instructions.push(Instruction::load_imm(R_DIR, HalValue::F64(0.0)));
    instructions.push(Instruction::new(
        Opcode::Eq,
        vec![Operand::Register(cond_reg), Operand::Register(R_DIR)],
    ));
    // Now cond_reg = 1 if original was 0 (no match → skip).
    let idx = instructions.len();
    instructions.push(Instruction::new(
        Opcode::JumpIf,
        vec![Operand::Register(cond_reg), Operand::Immediate(HalValue::U32(0))],
    )); // placeholder target
    idx
}

/// Patch a JumpIf instruction's target to point to the given instruction index.
fn patch_jump(
    instructions: &mut Vec<Instruction>,
    jump_idx: usize,
    target: usize,
) {
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
    fn test_generate_homing_program_non_empty() {
        let cfg = AxisGroupConfig::default_xyz();
        let prog = generate_homing_program(&cfg);
        assert!(!prog.instructions.is_empty());
        assert!(prog.instructions.last().unwrap().opcode == Opcode::Halt);
        // Should have signal bindings for all 3 axes × 7 signals = 21
        assert_eq!(prog.signals.len(), 21);
        assert_eq!(prog.name, "homing_group.0");
    }

    #[test]
    fn test_single_axis_homing() {
        let cfg = AxisGroupConfig::new(
            "group.0",
            vec![crate::config::AxisConfig::linear(0, "X")],
        );
        let prog = generate_homing_program(&cfg);
        assert!(!prog.instructions.is_empty());
        assert_eq!(prog.signals.len(), 7);
    }

    #[test]
    fn test_homing_signal_names() {
        let cfg = AxisGroupConfig::default_xyz();
        let prog = generate_homing_program(&cfg);
        let signal_names: Vec<&str> = prog.signals.iter().map(|s| s.hal_signal_name.as_str()).collect();
        assert!(signal_names.contains(&"group.group.0.axis.0.homing_state"));
        assert!(signal_names.contains(&"group.group.0.axis.0.homed"));
        assert!(signal_names.contains(&"group.group.0.axis.1.limit_pos"));
        assert!(signal_names.contains(&"group.group.0.axis.2.vel_cmd"));
    }

    #[test]
    fn test_limit_signal_selection() {
        assert_eq!(
            limit_signal_name("group.0.axis.0", HomeDirection::Positive),
            "group.0.axis.0.limit_pos"
        );
        assert_eq!(
            limit_signal_name("group.0.axis.0", HomeDirection::Negative),
            "group.0.axis.0.limit_neg"
        );
    }

    #[test]
    fn test_all_axes_get_vel_cmd() {
        let cfg = AxisGroupConfig::default_xyz();
        let prog = generate_homing_program(&cfg);
        let vel_signals: Vec<_> = prog
            .signals
            .iter()
            .filter(|s| s.hal_signal_name.ends_with(".vel_cmd"))
            .collect();
        assert_eq!(vel_signals.len(), 3);
    }
}
