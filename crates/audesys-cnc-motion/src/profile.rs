//! Trapezoidal velocity profile generator for multi-axis linear motion.
//!
//! Generates register-VM instructions that compute per-cycle velocity
//! and position updates for acceleration → cruise → deceleration phases.
//!
//! For short moves that never reach target velocity, a triangular profile
//! (accelerate then immediately decelerate) is used instead.

use audesys_hal_core::HalValue;
use audesys_hal_ir::instruction::{Instruction, Opcode};
use audesys_hal_ir::program::HalProgram;
use audesys_hal_ir::types::Operand;

// ── Register allocation for motion profile VM ──
// ponytail: fixed allocation, single-thread VM. These are local to the
// motion crate — the compiler uses its own register set. No collision.

const REG_COUNTER: u8 = 0;
const REG_POS_X: u8 = 1;
const REG_POS_Y: u8 = 2;
const REG_POS_Z: u8 = 3;
const REG_ZERO: u8 = 4;
const REG_ONE: u8 = 5;
const REG_VEL: u8 = 6;
const REG_VSTEP: u8 = 7;
const REG_TSTEP: u8 = 8;
const REG_RATIO: u8 = 9;
const REG_AXIS_STEP: u8 = 10;
const REG_DT: u8 = 11;

/// Configuration for a single trapezoidal motion segment.
pub struct TrapezoidalProfile {
    /// X-axis displacement (mm)
    pub dx: f64,
    /// Y-axis displacement (mm)
    pub dy: f64,
    /// Z-axis displacement (mm)
    pub dz: f64,
    /// Feedrate (mm/min)
    pub feedrate: f64,
    /// Acceleration (mm/s²)
    pub acceleration: f64,
    /// Scan cycle time (seconds) — ponytail: default 0.01 (10ms)
    pub dt: f64,
    /// Starting X position (mm)
    pub start_x: f64,
    /// Starting Y position (mm)
    pub start_y: f64,
    /// Starting Z position (mm)
    pub start_z: f64,
}

/// Generate a `HalProgram` that executes a trapezoidal velocity profile.
///
/// The program computes per-cycle velocity and position updates using
/// the VM's register arithmetic. On completion, `axis.0.pos`, `axis.1.pos`,
/// and `axis.2.pos` signals contain the final position.
pub fn generate_trapezoidal_program(profile: &TrapezoidalProfile) -> HalProgram {
    let mut instructions: Vec<Instruction> = Vec::new();

    // Load dt constant once
    instructions.push(Instruction::load_imm(REG_DT, HalValue::F64(profile.dt)));
    instructions.push(Instruction::load_imm(REG_ZERO, HalValue::F64(0.0)));
    instructions.push(Instruction::load_imm(REG_ONE, HalValue::F64(1.0)));

    emit_g1(profile, &mut instructions);

    // Store final positions as signals
    let signals = vec![
        signal_binding("axis.0.pos", "axis.0.pos"),
        signal_binding("axis.1.pos", "axis.1.pos"),
        signal_binding("axis.2.pos", "axis.2.pos"),
    ];

    HalProgram {
        name: "trapezoidal_motion".into(),
        instructions,
        signals,
        channels: vec![],
        function_table: vec![],
    }
}

fn signal_binding(name: &str, signal: &str) -> audesys_hal_ir::types::SignalBinding {
    audesys_hal_ir::types::SignalBinding {
        hal_signal_name: signal.into(),
        program_var: name.into(),
        direction: audesys_hal_ir::types::Direction::Write,
        hal_pin_type: audesys_hal_core::types::HalPinType::F64,
    }
}

/// G1 linear interpolation with trapezoidal velocity profile.
///
/// Three-phase motion: acceleration ramp → cruise → deceleration ramp.
/// Uses register-based velocity computation with VM Mul/Add/Sub/Cmp/JumpIf.
fn emit_g1(profile: &TrapezoidalProfile, instructions: &mut Vec<Instruction>) {
    let distance = (profile.dx * profile.dx + profile.dy * profile.dy + profile.dz * profile.dz).sqrt();
    if distance < 1e-9 {
        return;
    }

    let feedrate = if profile.feedrate > 0.0 { profile.feedrate } else { 100.0 };
    let v_target = feedrate / 60.0; // mm/s
    let a = profile.acceleration;
    let dt = profile.dt;

    // Trapezoidal profile phases
    let t_accel = v_target / a;
    let cycles_accel = (t_accel / dt).ceil() as u32;
    let dist_accel = 0.5 * a * t_accel * t_accel;
    let dist_cruise = distance - 2.0 * dist_accel;

    let cycles_cruise = if dist_cruise > 0.0 {
        (dist_cruise / v_target / dt).ceil() as u32
    } else {
        // Triangular profile (too short for cruise phase)
        let v_peak = (distance * a).sqrt();
        let t_peak = v_peak / a;
        let cycles_half = (t_peak / dt).ceil().max(1.0) as u32;
        let dv_adj = v_peak / cycles_half as f64;
        instructions.push(Instruction::load_imm(REG_VEL, HalValue::F64(0.0)));
        instructions.push(Instruction::load_imm(REG_VSTEP, HalValue::F64(dv_adj)));
        instructions.push(Instruction::load_imm(REG_POS_X, HalValue::F64(profile.start_x)));
        emit_triangular_motion(profile, cycles_half, instructions);
        return;
    };

    let cycles_decel = cycles_accel; // symmetric

    // Initialize position registers
    instructions.push(Instruction::load_imm(REG_POS_X, HalValue::F64(profile.start_x)));
    if profile.dy.abs() > 1e-9 {
        instructions.push(Instruction::load_imm(REG_POS_Y, HalValue::F64(profile.start_y)));
    }
    if profile.dz.abs() > 1e-9 {
        instructions.push(Instruction::load_imm(REG_POS_Z, HalValue::F64(profile.start_z)));
    }

    // Phase 1: Acceleration
    if cycles_accel > 0 {
        emit_profile_phase(
            instructions,
            profile,
            cycles_accel,
            v_target,
            a,
            true,
            false,
        );
    }
    // Phase 2: Cruise
    if cycles_cruise > 0 {
        emit_profile_phase(
            instructions,
            profile,
            cycles_cruise,
            v_target,
            a,
            false,
            false,
        );
    }
    // Phase 3: Deceleration
    if cycles_decel > 0 {
        emit_profile_phase(
            instructions,
            profile,
            cycles_decel,
            v_target,
            a,
            false,
            true,
        );
    }
}

/// Emit one phase (accel/cruise/decel) of the trapezoidal profile.
fn emit_profile_phase(
    instructions: &mut Vec<Instruction>,
    profile: &TrapezoidalProfile,
    phase_cycles: u32,
    v_target: f64,
    a: f64,
    is_accel: bool,
    is_decel: bool,
) {
    if phase_cycles == 0 {
        return;
    }

    let distance = (profile.dx * profile.dx + profile.dy * profile.dy + profile.dz * profile.dz).sqrt();

    // Load velocity step dv = a * dt
    let dv = a * profile.dt;
    instructions.push(Instruction::load_imm(REG_VSTEP, HalValue::F64(dv)));

    // Set initial velocity: 0 for first accel, v_target for cruise/decel
    let v_start = if is_accel { 0.0 } else { v_target };
    instructions.push(Instruction::load_imm(REG_VEL, HalValue::F64(v_start)));

    // Load counter
    instructions.push(Instruction::load_imm(REG_COUNTER, HalValue::F64(phase_cycles as f64)));

    let loop_start = instructions.len() as u32;

    // tstep = vel * dt  (Mul)
    instructions.push(Instruction::arith(Opcode::Mul, REG_VEL, REG_DT, REG_TSTEP));

    // X axis (always)
    emit_axis_step(instructions, profile.dx / distance, REG_POS_X, "axis.0.pos");
    // Y axis (if moving)
    if profile.dy.abs() > 1e-9 {
        emit_axis_step(instructions, profile.dy / distance, REG_POS_Y, "axis.1.pos");
    }
    // Z axis (if moving)
    if profile.dz.abs() > 1e-9 {
        emit_axis_step(instructions, profile.dz / distance, REG_POS_Z, "axis.2.pos");
    }

    // Velocity update: accel += dv, decel -= dv, cruise = no change
    if is_accel {
        instructions.push(Instruction::arith(Opcode::Add, REG_VEL, REG_VSTEP, REG_VEL));
    } else if is_decel {
        instructions.push(Instruction::arith(Opcode::Sub, REG_VEL, REG_VSTEP, REG_VEL));
    }

    // Decrement counter and loop
    instructions.push(Instruction::arith(Opcode::Sub, REG_COUNTER, REG_ONE, REG_COUNTER));
    instructions.push(Instruction::cmp(Opcode::Gt, REG_COUNTER, REG_ZERO));
    instructions.push(Instruction::jump_if(loop_start));
}

/// Emit per-axis step computation: axis_step = tstep * ratio, then pos += axis_step.
fn emit_axis_step(instructions: &mut Vec<Instruction>, ratio: f64, pos_reg: u8, signal: &str) {
    // r10 = ratio, r11 = r9 * r10 (axis_step)
    instructions.push(Instruction::load_imm(REG_RATIO, HalValue::F64(ratio)));
    instructions.push(Instruction::arith(Opcode::Mul, REG_TSTEP, REG_RATIO, REG_AXIS_STEP));
    // pos += axis_step
    instructions.push(Instruction::arith(Opcode::Add, pos_reg, REG_AXIS_STEP, pos_reg));
    // Store signal
    instructions.push(Instruction::new(
        Opcode::Store,
        vec![
            Operand::SignalName(signal.into()),
            Operand::Register(pos_reg),
        ],
    ));
}

/// Triangular velocity profile (accel then immediate decel, no cruise).
fn emit_triangular_motion(
    profile: &TrapezoidalProfile,
    cycles_half: u32,
    instructions: &mut Vec<Instruction>,
) {
    if profile.dy.abs() > 1e-9 {
        instructions.push(Instruction::load_imm(REG_POS_Y, HalValue::F64(profile.start_y)));
    }
    if profile.dz.abs() > 1e-9 {
        instructions.push(Instruction::load_imm(REG_POS_Z, HalValue::F64(profile.start_z)));
    }

    let distance = (profile.dx * profile.dx + profile.dy * profile.dy + profile.dz * profile.dz).sqrt();

    let total = cycles_half * 2;
    instructions.push(Instruction::load_imm(REG_COUNTER, HalValue::F64(total as f64)));

    // Store half-cycles marker for phase switch
    instructions.push(Instruction::load_imm(REG_RATIO, HalValue::F64(cycles_half as f64)));

    let loop_start = instructions.len() as u32;

    // Compute tstep = vel * dt  (Mul)
    instructions.push(Instruction::arith(Opcode::Mul, REG_VEL, REG_DT, REG_TSTEP));

    // Axis steps
    emit_axis_step(instructions, profile.dx / distance, REG_POS_X, "axis.0.pos");
    if profile.dy.abs() > 1e-9 {
        emit_axis_step(instructions, profile.dy / distance, REG_POS_Y, "axis.1.pos");
    }
    if profile.dz.abs() > 1e-9 {
        emit_axis_step(instructions, profile.dz / distance, REG_POS_Z, "axis.2.pos");
    }

    // Phase switch: if counter > half → accel, else → decel
    instructions.push(Instruction::cmp(Opcode::Gt, REG_COUNTER, REG_RATIO));
    let jif_idx = instructions.len();
    instructions.push(Instruction::nop()); // placeholder
    // Accel path: vel += dv
    instructions.push(Instruction::arith(Opcode::Add, REG_VEL, REG_VSTEP, REG_VEL));
    let jump_idx = instructions.len();
    instructions.push(Instruction::nop()); // placeholder
    // Decel path: vel -= dv
    let decel_start = instructions.len() as u32;
    instructions.push(Instruction::arith(Opcode::Sub, REG_VEL, REG_VSTEP, REG_VEL));

    // Patch placeholders
    instructions[jif_idx] = Instruction::jump_if(decel_start);
    instructions[jump_idx] = Instruction::jump((decel_start + 1) as u32);

    // Loop control
    instructions.push(Instruction::arith(Opcode::Sub, REG_COUNTER, REG_ONE, REG_COUNTER));
    instructions.push(Instruction::cmp(Opcode::Gt, REG_COUNTER, REG_ZERO));
    instructions.push(Instruction::jump_if(loop_start));
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_move() {
        let profile = TrapezoidalProfile {
            dx: 0.0,
            dy: 0.0,
            dz: 0.0,
            feedrate: 100.0,
            acceleration: 500.0,
            dt: 0.01,
            start_x: 0.0,
            start_y: 0.0,
            start_z: 0.0,
        };
        let program = generate_trapezoidal_program(&profile);
        // Zero-distance move should produce a minimal program (constants only, no motion loop)
        assert!(program.instructions.len() > 0);
    }

    #[test]
    fn test_trapezoidal_motion_generates_instructions() {
        let profile = TrapezoidalProfile {
            dx: 100.0,
            dy: 0.0,
            dz: 0.0,
            feedrate: 300.0,
            acceleration: 500.0,
            dt: 0.01,
            start_x: 0.0,
            start_y: 0.0,
            start_z: 0.0,
        };
        let program = generate_trapezoidal_program(&profile);
        assert!(program.instructions.len() > 20);
        // Should contain velocity/position loops with JumpIf
        let has_jump_if = program
            .instructions
            .iter()
            .any(|inst| inst.opcode == Opcode::JumpIf);
        assert!(has_jump_if);
    }

    #[test]
    fn test_short_move_triangular() {
        let profile = TrapezoidalProfile {
            dx: 1.0, // very short move → triangular profile
            dy: 0.0,
            dz: 0.0,
            feedrate: 100.0,
            acceleration: 500.0,
            dt: 0.01,
            start_x: 0.0,
            start_y: 0.0,
            start_z: 0.0,
        };
        let program = generate_trapezoidal_program(&profile);
        assert!(program.instructions.len() > 0);
        let has_jump_if = program
            .instructions
            .iter()
            .any(|inst| inst.opcode == Opcode::JumpIf);
        assert!(has_jump_if);
    }

    #[test]
    fn test_multi_axis_motion() {
        let profile = TrapezoidalProfile {
            dx: 50.0,
            dy: 30.0,
            dz: 20.0,
            feedrate: 200.0,
            acceleration: 400.0,
            dt: 0.01,
            start_x: 10.0,
            start_y: 5.0,
            start_z: 0.0,
        };
        let program = generate_trapezoidal_program(&profile);
        assert!(program.instructions.len() > 30);
    }
}
