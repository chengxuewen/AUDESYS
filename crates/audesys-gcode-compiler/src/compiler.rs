//! G-code IR compiler — converts [GCodeCommand] lines to [HalProgram].
//!
//! Uses modal state tracking (G90/G91 relative, G0/G1/G2/G3 motion mode,
//! G20/G21 units, G17/G18/G19 plane) to generate register-VM instructions
//! for motion, spindle, and program control.

use crate::GCodeError;
use crate::parser::{CommandKind, GCodeCommand};
use audesys_hal_core::HalValue;
use audesys_hal_core::types::HalPinType;
use audesys_hal_ir::instruction::{Instruction, Opcode};
use audesys_hal_ir::program::HalProgram;
use audesys_hal_ir::types::{Direction, SignalBinding};

/// Modal state tracker — accumulates persistent G-code context across lines.
///
/// All updates are immutable: `advance()` returns a new `ModalState`.
#[derive(Debug, Clone)]
pub struct ModalState {
    /// Current motion mode: 0 = rapid, 1 = linear, 2 = CW arc, 3 = CCW arc
    pub motion_mode: u32,
    /// Coordinate mode: 90 = absolute, 91 = incremental
    pub coord_mode: u32,
    /// Unit mode: 20 = inch, 21 = mm
    pub unit_mode: u32,
    /// Active plane: 17 = XY, 18 = XZ, 19 = YZ
    pub plane: u32,
    /// Current feedrate (mm/min or inch/min)
    pub feedrate: f64,
    /// Current spindle speed (RPM)
    pub spindle_rpm: f64,
    /// Acceleration (mm/s^2) for trapezoidal motion profile
    /// ponytail: default 500.0, configurable via G-code or config
    pub acceleration: f64,
    /// Current X position (in program coordinates)
    pub current_x: f64,
    /// Current Y position
    pub current_y: f64,
    /// Current Z position
    pub current_z: f64,
    /// Last processed line number
    pub line_number: u32,
}

impl ModalState {
    /// Default power-on state: G0 motion, G90 absolute, G21 mm, G17 XY plane.
    pub fn new() -> Self {
        ModalState {
            motion_mode: 0, // G0 (rapid) default
            coord_mode: 90, // G90 (absolute)
            unit_mode: 21,  // G21 (mm)
            plane: 17,      // G17 (XY)
            feedrate: 0.0,
            spindle_rpm: 0.0,
            acceleration: 500.0, // ponytail: 500 mm/s^2 (typical 3D printer default)
            current_x: 0.0,
            current_y: 0.0,
            current_z: 0.0,
            line_number: 0,
        }
    }

    /// Advance modal state by applying one [GCodeCommand].
    ///
    /// Returns a new `ModalState` (immutable update). Axis positions are
    /// only updated for motion commands that specify them.
    pub fn advance(&self, cmd: &GCodeCommand) -> ModalState {
        let mut next = self.clone();
        next.line_number = cmd.line;

        match cmd.kind {
            CommandKind::Motion => {
                // Update motion mode from G-code
                if let Some(g) = cmd.g_code {
                    if (0..=3).contains(&g) {
                        next.motion_mode = g;
                    }
                }
                // Update position (absolute or incremental)
                next = next.update_position(cmd);
                // Update feedrate if specified
                if let Some(f) = cmd.f {
                    next.feedrate = f;
                }
            }
            CommandKind::Spindle => {
                if let Some(s) = cmd.s {
                    next.spindle_rpm = s;
                }
            }
            CommandKind::Modal => {
                if let Some(g) = cmd.g_code {
                    match g {
                        17 | 18 | 19 => next.plane = g,
                        20 | 21 => next.unit_mode = g,
                        90 | 91 => next.coord_mode = g,
                        80 => {
                            next.motion_mode = 0; // cancel canned cycles → rapid
                        }
                        _ => {}
                    }
                }
            }
            CommandKind::ProgramControl => {
                // M2/M30 don't change modal state
            }
            CommandKind::Unknown => {
                // No state change
            }
        }

        next
    }

    /// Update axis positions from a motion command.
    fn update_position(&self, cmd: &GCodeCommand) -> ModalState {
        let mut next = self.clone();
        if self.coord_mode == 90 {
            // Absolute: set position to command value (or keep current)
            if let Some(x) = cmd.x {
                next.current_x = x;
            }
            if let Some(y) = cmd.y {
                next.current_y = y;
            }
            if let Some(z) = cmd.z {
                next.current_z = z;
            }
        } else {
            // Incremental (G91): add to current
            if let Some(x) = cmd.x {
                next.current_x += x;
            }
            if let Some(y) = cmd.y {
                next.current_y += y;
            }
            if let Some(z) = cmd.z {
                next.current_z += z;
            }
        }
        next
    }
}

impl Default for ModalState {
    fn default() -> Self {
        Self::new()
    }
}

// Register allocation convention (ponytail: fixed, single-thread VM)
const REG_STEP: u8 = 0; // r0 = step size (scratch)
const REG_COUNTER: u8 = 1; // r1 = cycle counter
const REG_POS_X: u8 = 2; // r2 = axis X position
const REG_POS_Y: u8 = 3; // r3 = axis Y position
const REG_POS_Z: u8 = 4; // r4 = axis Z position
const REG_ZERO: u8 = 5; // r5 = constant 0.0
const REG_ONE: u8 = 6; // r6 = constant 1.0
const REG_VEL: u8 = 7; // r7 = current velocity (mm/s)
const REG_VSTEP: u8 = 8; // r8 = velocity step per cycle = acceleration*dt
const REG_TSTEP: u8 = 9; // r9 = total step this cycle = vel*dt (computed via Mul)
const REG_RATIO: u8 = 10; // r10 = per-axis distance ratio (pre-computed, scalar)
const REG_AXIS_STEP: u8 = 11; // r11 = per-axis step (scratch for Mul)
const REG_DT: u8 = 12; // r12 = scan cycle time dt (0.01s, loaded once)

/// Compile a sequence of G-code commands into a [HalProgram].
///
/// Modal state is advanced line-by-line. Motion commands emit IR instructions
/// that update axis positions through the register VM.
pub fn compile_commands(
    commands: &[GCodeCommand],
    initial_modal: &ModalState,
) -> Result<HalProgram, GCodeError> {
    let mut instructions: Vec<Instruction> = Vec::new();
    let mut signals: Vec<SignalBinding> = Vec::new();
    let mut state = initial_modal.clone();

    // Pre-declare axis signal bindings
    ensure_axis_signals(&mut signals);

    // Initialize constants
    // ponytail: r5 = 0.0, r6 = 1.0 — loaded once at program start
    instructions.push(Instruction::load_imm(REG_ZERO, HalValue::F64(0.0)));
    instructions.push(Instruction::load_imm(REG_ONE, HalValue::F64(1.0)));
    // ponytail: scan cycle = 10ms (0.01s), loaded once for motion planner
    instructions.push(Instruction::load_imm(REG_DT, HalValue::F64(0.01)));

    for cmd in commands {
        match cmd.kind {
            CommandKind::Motion => {
                emit_motion(cmd, &state, &mut instructions, &mut signals)?;
            }
            CommandKind::Spindle => {
                emit_spindle(cmd, &mut instructions, &mut signals);
            }
            CommandKind::Modal => {
                // Modal commands update state only — no IR emission
            }
            CommandKind::ProgramControl => {
                emit_program_control(cmd, &mut instructions);
            }
            CommandKind::Unknown => {
                if let Some(g) = cmd.g_code {
                    return Err(GCodeError::UnsupportedCommand {
                        line: cmd.line,
                        code: format!("G{}", g),
                    });
                }
                if let Some(m) = cmd.m_code {
                    return Err(GCodeError::UnsupportedCommand {
                        line: cmd.line,
                        code: format!("M{}", m),
                    });
                }
            }
        }
        state = state.advance(cmd);
    }

    Ok(HalProgram {
        name: "gcode_program".into(),
        instructions,
        signals,
        channels: vec![],
        function_table: vec![],
    })
}

/// Emit motion IR for G0/G1/G2/G3 commands.
fn emit_motion(
    cmd: &GCodeCommand,
    state: &ModalState,
    instructions: &mut Vec<Instruction>,
    _signals: &mut Vec<SignalBinding>,
) -> Result<(), GCodeError> {
    let prev = state.clone();
    let next = state.advance(cmd);

    match cmd.g_code.unwrap_or(state.motion_mode) {
        0 => emit_g0(&next, instructions),
        1 => emit_g1(&prev, &next, instructions),
        2 | 3 => {
            let g_code = cmd.g_code.unwrap();
            emit_arc(g_code, &prev, &next, cmd, instructions)?;
        }
        _ => {
            return Err(GCodeError::UnsupportedCommand {
                line: cmd.line,
                code: format!("G{}", cmd.g_code.unwrap()),
            });
        }
    }

    Ok(())
}

/// Chord tolerance for arc subdivision (mm).
/// ponytail: 0.005mm = 5µm, typical CNC precision.
const CHORD_TOLERANCE: f64 = 0.005;

/// Maximum angular step per chord segment (30° = π/6).
const MAX_ANGULAR_STEP: f64 = std::f64::consts::PI / 6.0;

/// Emit arc IR for G2 (CW) / G3 (CCW) circular interpolation.
///
/// Supports I/J/K center-offset format and R radius format.
/// Handles G17 (XY), G18 (ZX), G19 (YZ) planes.
/// Helical: third axis interpolated linearly alongside arc.
fn emit_arc(
    g_code: u32,
    prev: &ModalState,
    next: &ModalState,
    cmd: &GCodeCommand,
    instructions: &mut Vec<Instruction>,
) -> Result<(), GCodeError> {
    let plane = prev.plane;

    // Map plane axes to coordinate fields and signal names.
    // For each plane we identify (arc_axis_a, arc_axis_b, linear_axis).
    let (start_a, start_b, start_linear): (f64, f64, f64);
    let (end_a, end_b, end_linear): (f64, f64, f64);
    let (a_signal, b_signal, linear_signal): (&str, &str, &str);
    let (enable_a, enable_b, enable_linear): (&str, &str, &str);

    match plane {
        17 => {
            start_a = prev.current_x; start_b = prev.current_y; start_linear = prev.current_z;
            end_a = next.current_x; end_b = next.current_y; end_linear = next.current_z;
            a_signal = "axis.0.pos"; b_signal = "axis.1.pos"; linear_signal = "axis.2.pos";
            enable_a = "axis.0.enable"; enable_b = "axis.1.enable"; enable_linear = "axis.2.enable";
        }
        18 => {
            start_a = prev.current_z; start_b = prev.current_x; start_linear = prev.current_y;
            end_a = next.current_z; end_b = next.current_x; end_linear = next.current_y;
            a_signal = "axis.2.pos"; b_signal = "axis.0.pos"; linear_signal = "axis.1.pos";
            enable_a = "axis.2.enable"; enable_b = "axis.0.enable"; enable_linear = "axis.1.enable";
        }
        19 => {
            start_a = prev.current_y; start_b = prev.current_z; start_linear = prev.current_x;
            end_a = next.current_y; end_b = next.current_z; end_linear = next.current_x;
            a_signal = "axis.1.pos"; b_signal = "axis.2.pos"; linear_signal = "axis.0.pos";
            enable_a = "axis.1.enable"; enable_b = "axis.2.enable"; enable_linear = "axis.0.enable";
        }
        _ => {
            return Err(GCodeError::UnsupportedCommand {
                line: cmd.line,
                code: format!("G{}", g_code),
            });
        }
    }

    // Calculate arc center
    let (center_a, center_b) = calculate_arc_center(
        start_a, start_b, end_a, end_b,
        cmd.i, cmd.j, cmd.k, cmd.r,
        plane, cmd.line,
    )?;

    let radius = ((start_a - center_a).powi(2) + (start_b - center_b).powi(2)).sqrt();
    if radius < 1e-9 {
        return Err(GCodeError::UnsupportedCommand {
            line: cmd.line,
            code: "zero-radius arc".into(),
        });
    }

    // Calculate start and end angles
    let start_angle = (start_b - center_b).atan2(start_a - center_a);
    let end_angle = (end_b - center_b).atan2(end_a - center_a);

    // Handle full circle: start ≈ end with non-zero radius → sweep = ±2π
    let is_full_circle = (end_a - start_a).hypot(end_b - start_b) < 1e-6;

    let sweep = if is_full_circle {
        if g_code == 2 { -2.0 * std::f64::consts::PI } else { 2.0 * std::f64::consts::PI }
    } else if g_code == 2 {
        // G2 CW: sweep is always negative or zero
        let mut s = end_angle - start_angle;
        if s > 0.0 { s -= 2.0 * std::f64::consts::PI; }
        s
    } else {
        // G3 CCW: sweep is always positive or zero
        let mut s = end_angle - start_angle;
        if s < 0.0 { s += 2.0 * std::f64::consts::PI; }
        s
    };

    if sweep.abs() < 1e-9 {
        return Ok(());
    }

    // Chord subdivision
    let angular_step = if radius > CHORD_TOLERANCE {
        (2.0 * (1.0 - CHORD_TOLERANCE / radius).acos()).min(MAX_ANGULAR_STEP)
    } else {
        MAX_ANGULAR_STEP
    };
    let num_segments = ((sweep.abs() / angular_step).ceil() as u32).max(1);
    let angle_per_segment = sweep / num_segments as f64;

    let linear_delta = end_linear - start_linear;
    let linear_per_segment = linear_delta / num_segments as f64;

    // Load enable=true into r0 — reused for all Store instructions
    instructions.push(Instruction::load_imm(REG_STEP, HalValue::Bool(true)));

    // Emit chord segments (iterate 1..=num_segments to skip start, include end)
    for i in 1..=num_segments {
        let angle = start_angle + i as f64 * angle_per_segment;
        let a = center_a + radius * angle.cos();
        let b = center_b + radius * angle.sin();
        let l = start_linear + i as f64 * linear_per_segment;

        // Store axis A position
        instructions.push(Instruction::load_imm(REG_POS_X, HalValue::F64(a)));
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                audesys_hal_ir::types::Operand::SignalName(a_signal.into()),
                audesys_hal_ir::types::Operand::Register(REG_POS_X),
            ],
        ));
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                audesys_hal_ir::types::Operand::SignalName(enable_a.into()),
                audesys_hal_ir::types::Operand::Register(REG_STEP),
            ],
        ));

        // Store axis B position
        instructions.push(Instruction::load_imm(REG_POS_X, HalValue::F64(b)));
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                audesys_hal_ir::types::Operand::SignalName(b_signal.into()),
                audesys_hal_ir::types::Operand::Register(REG_POS_X),
            ],
        ));
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                audesys_hal_ir::types::Operand::SignalName(enable_b.into()),
                audesys_hal_ir::types::Operand::Register(REG_STEP),
            ],
        ));

        // Store linear axis position
        instructions.push(Instruction::load_imm(REG_POS_X, HalValue::F64(l)));
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                audesys_hal_ir::types::Operand::SignalName(linear_signal.into()),
                audesys_hal_ir::types::Operand::Register(REG_POS_X),
            ],
        ));
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                audesys_hal_ir::types::Operand::SignalName(enable_linear.into()),
                audesys_hal_ir::types::Operand::Register(REG_STEP),
            ],
        ));
    }

    Ok(())
}

/// Calculate arc center from I/J/K offsets or R radius.
fn calculate_arc_center(
    start_a: f64,
    start_b: f64,
    end_a: f64,
    end_b: f64,
    i: Option<f64>,
    j: Option<f64>,
    k: Option<f64>,
    r: Option<f64>,
    plane: u32,
    line: u32,
) -> Result<(f64, f64), GCodeError> {
    // I/J/K offset method (incremental from start)
    if i.is_some() || j.is_some() || k.is_some() {
        let (io, jo) = match plane {
            17 => (i.unwrap_or(0.0), j.unwrap_or(0.0)),
            18 => (k.unwrap_or(0.0), i.unwrap_or(0.0)),
            19 => (j.unwrap_or(0.0), k.unwrap_or(0.0)),
            _ => {
                return Err(GCodeError::UnsupportedCommand {
                    line,
                    code: format!("plane G{}", plane),
                });
            }
        };
        return Ok((start_a + io, start_b + jo));
    }

    // R radius method
    if let Some(radius) = r {
        let dx = end_a - start_a;
        let dy = end_b - start_b;
        let chord_len = (dx * dx + dy * dy).sqrt();
        if chord_len < 1e-9 {
            return Err(GCodeError::UnsupportedCommand {
                line,
                code: "zero-length arc with R".into(),
            });
        }

        let r_abs = radius.abs();
        if r_abs < chord_len / 2.0 - 1e-9 {
            return Err(GCodeError::UnsupportedCommand {
                line,
                code: format!("radius {} too small for chord length {}", r_abs, chord_len),
            });
        }

        let half_chord = chord_len / 2.0;
        // ponytail: max(0.0) guards f64 rounding producing tiny negative
        let center_offset = (r_abs * r_abs - half_chord * half_chord).max(0.0).sqrt();
        let mid_a = (start_a + end_a) / 2.0;
        let mid_b = (start_b + end_b) / 2.0;

        // Perpendicular to chord (left side = standard orientation)
        let perp_a = -dy / chord_len;
        let perp_b = dx / chord_len;

        // R > 0 → short arc (≤ 180°), R < 0 → long arc (> 180°)
        let sign = if radius > 0.0 { 1.0 } else { -1.0 };
        Ok((
            mid_a + sign * perp_a * center_offset,
            mid_b + sign * perp_b * center_offset,
        ))
    } else {
        Err(GCodeError::UnsupportedCommand {
            line,
            code: "arc missing I/J/K or R".into(),
        })
    }
}

/// G0 rapid: store target positions to axis signals directly.
fn emit_g0(state: &ModalState, instructions: &mut Vec<Instruction>) {
    // Store X position
    instructions.push(Instruction::load_imm(REG_POS_X, HalValue::F64(state.current_x)));
    instructions.push(Instruction::new(
        Opcode::Store,
        vec![
            audesys_hal_ir::types::Operand::SignalName("axis.0.pos".into()),
            audesys_hal_ir::types::Operand::Register(REG_POS_X),
        ],
    ));
    // Enable axis
    instructions.push(Instruction::load_imm(REG_STEP, HalValue::Bool(true)));
    instructions.push(Instruction::new(
        Opcode::Store,
        vec![
            audesys_hal_ir::types::Operand::SignalName("axis.0.enable".into()),
            audesys_hal_ir::types::Operand::Register(REG_STEP),
        ],
    ));

    // Store Y position if changed
    if state.current_y != 0.0 {
        instructions.push(Instruction::load_imm(REG_POS_Y, HalValue::F64(state.current_y)));
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                audesys_hal_ir::types::Operand::SignalName("axis.1.pos".into()),
                audesys_hal_ir::types::Operand::Register(REG_POS_Y),
            ],
        ));
        instructions.push(Instruction::load_imm(REG_STEP, HalValue::Bool(true)));
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                audesys_hal_ir::types::Operand::SignalName("axis.1.enable".into()),
                audesys_hal_ir::types::Operand::Register(REG_STEP),
            ],
        ));
    }

    // Store Z position if changed
    if state.current_z != 0.0 {
        instructions.push(Instruction::load_imm(REG_POS_Z, HalValue::F64(state.current_z)));
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                audesys_hal_ir::types::Operand::SignalName("axis.2.pos".into()),
                audesys_hal_ir::types::Operand::Register(REG_POS_Z),
            ],
        ));
        instructions.push(Instruction::load_imm(REG_STEP, HalValue::Bool(true)));
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                audesys_hal_ir::types::Operand::SignalName("axis.2.enable".into()),
                audesys_hal_ir::types::Operand::Register(REG_STEP),
            ],
        ));
    }
}

/// G1 linear interpolation with trapezoidal velocity profile.
///
/// Three-phase motion: acceleration ramp → cruise → deceleration ramp.
/// Uses register-based velocity computation with VM Mul/Add/Sub/Cmp/JumpIf.
fn emit_g1(prev: &ModalState, next: &ModalState, instructions: &mut Vec<Instruction>) {
    let dx = next.current_x - prev.current_x;
    let dy = next.current_y - prev.current_y;
    let dz = next.current_z - prev.current_z;
    let distance = (dx * dx + dy * dy + dz * dz).sqrt();
    if distance < 1e-9 {
        return;
    }

    let feedrate = if next.feedrate > 0.0 { next.feedrate } else { 100.0 };
    let dt = 0.01; // ponytail: 10ms scan cycle
    let v_target = feedrate / 60.0; // mm/s
    let a = next.acceleration;

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
        instructions.push(Instruction::load_imm(REG_POS_X, HalValue::F64(prev.current_x)));
        emit_triangular_motion(instructions, dx, dy, dz, distance, cycles_half, prev);
        return;
    };

    let cycles_decel = cycles_accel; // symmetric

    // Initialize position registers
    instructions.push(Instruction::load_imm(REG_POS_X, HalValue::F64(prev.current_x)));
    if dy.abs() > 1e-9 {
        instructions.push(Instruction::load_imm(REG_POS_Y, HalValue::F64(prev.current_y)));
    }
    if dz.abs() > 1e-9 {
        instructions.push(Instruction::load_imm(REG_POS_Z, HalValue::F64(prev.current_z)));
    }

    // Phase 1: Acceleration
    if cycles_accel > 0 {
        emit_profile_phase(
            instructions,
            dx,
            dy,
            dz,
            distance,
            cycles_accel,
            v_target,
            a,
            dt,
            true,
            false,
        );
    }
    // Phase 2: Cruise
    if cycles_cruise > 0 {
        emit_profile_phase(
            instructions,
            dx,
            dy,
            dz,
            distance,
            cycles_cruise,
            v_target,
            a,
            dt,
            false,
            false,
        );
    }
    // Phase 3: Deceleration
    if cycles_decel > 0 {
        emit_profile_phase(
            instructions,
            dx,
            dy,
            dz,
            distance,
            cycles_decel,
            v_target,
            a,
            dt,
            false,
            true,
        );
    }
}

/// Emit one phase (accel/cruise/decel) of the trapezoidal profile.
fn emit_profile_phase(
    instructions: &mut Vec<Instruction>,
    dx: f64,
    dy: f64,
    dz: f64,
    distance: f64,
    phase_cycles: u32,
    v_target: f64,
    a: f64,
    dt: f64,
    is_accel: bool,
    is_decel: bool,
) {
    if phase_cycles == 0 {
        return;
    }

    // Load velocity step dv = a * dt
    let dv = a * dt;
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
    emit_axis_step(instructions, dx / distance, REG_POS_X, "axis.0.pos");
    // Y axis (if moving)
    if dy.abs() > 1e-9 {
        emit_axis_step(instructions, dy / distance, REG_POS_Y, "axis.1.pos");
    }
    // Z axis (if moving)
    if dz.abs() > 1e-9 {
        emit_axis_step(instructions, dz / distance, REG_POS_Z, "axis.2.pos");
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
            audesys_hal_ir::types::Operand::SignalName(signal.into()),
            audesys_hal_ir::types::Operand::Register(pos_reg),
        ],
    ));
}

/// Triangular velocity profile (accel then immediate decel, no cruise).
fn emit_triangular_motion(
    instructions: &mut Vec<Instruction>,
    dx: f64,
    dy: f64,
    dz: f64,
    distance: f64,
    cycles_half: u32,
    prev: &ModalState,
) {
    if dy.abs() > 1e-9 {
        instructions.push(Instruction::load_imm(REG_POS_Y, HalValue::F64(prev.current_y)));
    }
    if dz.abs() > 1e-9 {
        instructions.push(Instruction::load_imm(REG_POS_Z, HalValue::F64(prev.current_z)));
    }

    let total = cycles_half * 2;
    instructions.push(Instruction::load_imm(REG_COUNTER, HalValue::F64(total as f64)));

    // Store half-cycles marker for phase switch
    instructions.push(Instruction::load_imm(REG_RATIO, HalValue::F64(cycles_half as f64)));

    let loop_start = instructions.len() as u32;

    // Compute tstep = vel * dt  (Mul)
    instructions.push(Instruction::arith(Opcode::Mul, REG_VEL, REG_DT, REG_TSTEP));

    // Axis steps
    emit_axis_step(instructions, dx / distance, REG_POS_X, "axis.0.pos");
    if dy.abs() > 1e-9 {
        emit_axis_step(instructions, dy / distance, REG_POS_Y, "axis.1.pos");
    }
    if dz.abs() > 1e-9 {
        emit_axis_step(instructions, dz / distance, REG_POS_Z, "axis.2.pos");
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

/// Emit spindle commands: M3/M4 set direction, S sets speed, M5 stops.
fn emit_spindle(
    cmd: &GCodeCommand,
    instructions: &mut Vec<Instruction>,
    _signals: &mut Vec<SignalBinding>,
) {
    if let Some(s) = cmd.s {
        instructions.push(Instruction::load_imm(REG_STEP, HalValue::F64(s)));
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                audesys_hal_ir::types::Operand::SignalName("spindle.rpm".into()),
                audesys_hal_ir::types::Operand::Register(REG_STEP),
            ],
        ));
    }

    match cmd.m_code {
        Some(3) => {
            // M3: spindle clockwise
            instructions.push(Instruction::load_imm(REG_STEP, HalValue::Bool(true)));
            instructions.push(Instruction::new(
                Opcode::Store,
                vec![
                    audesys_hal_ir::types::Operand::SignalName("spindle.cw".into()),
                    audesys_hal_ir::types::Operand::Register(REG_STEP),
                ],
            ));
        }
        Some(4) => {
            // M4: spindle counter-clockwise
            instructions.push(Instruction::load_imm(REG_STEP, HalValue::Bool(true)));
            instructions.push(Instruction::new(
                Opcode::Store,
                vec![
                    audesys_hal_ir::types::Operand::SignalName("spindle.ccw".into()),
                    audesys_hal_ir::types::Operand::Register(REG_STEP),
                ],
            ));
        }
        Some(5) => {
            // M5: spindle stop — turn off both directions
            instructions.push(Instruction::load_imm(REG_STEP, HalValue::Bool(false)));
            instructions.push(Instruction::new(
                Opcode::Store,
                vec![
                    audesys_hal_ir::types::Operand::SignalName("spindle.cw".into()),
                    audesys_hal_ir::types::Operand::Register(REG_STEP),
                ],
            ));
            instructions.push(Instruction::new(
                Opcode::Store,
                vec![
                    audesys_hal_ir::types::Operand::SignalName("spindle.ccw".into()),
                    audesys_hal_ir::types::Operand::Register(REG_STEP),
                ],
            ));
            // Stop RPM too
            instructions.push(Instruction::load_imm(REG_STEP, HalValue::F64(0.0)));
            instructions.push(Instruction::new(
                Opcode::Store,
                vec![
                    audesys_hal_ir::types::Operand::SignalName("spindle.rpm".into()),
                    audesys_hal_ir::types::Operand::Register(REG_STEP),
                ],
            ));
        }
        _ => {}
    }
}

/// Emit program control: M2/M30 halt. M30 also stops spindle.
fn emit_program_control(cmd: &GCodeCommand, instructions: &mut Vec<Instruction>) {
    if cmd.m_code == Some(30) {
        // M30: stop spindle, then halt
        instructions.push(Instruction::load_imm(REG_STEP, HalValue::Bool(false)));
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                audesys_hal_ir::types::Operand::SignalName("spindle.cw".into()),
                audesys_hal_ir::types::Operand::Register(REG_STEP),
            ],
        ));
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                audesys_hal_ir::types::Operand::SignalName("spindle.ccw".into()),
                audesys_hal_ir::types::Operand::Register(REG_STEP),
            ],
        ));
    }
    if cmd.m_code == Some(2) || cmd.m_code == Some(30) {
        instructions.push(Instruction::halt());
    }
}

/// Ensure axis.0–axis.2 signal bindings are declared.
fn ensure_axis_signals(signals: &mut Vec<SignalBinding>) {
    let axes = [
        ("axis.0.pos", "axis.0.enable"),
        ("axis.1.pos", "axis.1.enable"),
        ("axis.2.pos", "axis.2.enable"),
    ];
    for (pos_name, en_name) in &axes {
        if !signals.iter().any(|s| s.hal_signal_name == *pos_name) {
            signals.push(SignalBinding {
                hal_signal_name: pos_name.to_string(),
                program_var: pos_name.replace('.', "_"),
                direction: Direction::Write,
                hal_pin_type: HalPinType::F64,
            });
        }
        if !signals.iter().any(|s| s.hal_signal_name == *en_name) {
            signals.push(SignalBinding {
                hal_signal_name: en_name.to_string(),
                program_var: en_name.replace('.', "_"),
                direction: Direction::Write,
                hal_pin_type: HalPinType::Bool,
            });
        }
    }
    // Spindle signals
    for name in &["spindle.rpm", "spindle.cw", "spindle.ccw"] {
        if !signals.iter().any(|s| s.hal_signal_name == *name) {
            signals.push(SignalBinding {
                hal_signal_name: name.to_string(),
                program_var: name.replace('.', "_"),
                direction: Direction::Write,
                hal_pin_type: if *name == "spindle.rpm" {
                    HalPinType::F64
                } else {
                    HalPinType::Bool
                },
            });
        }
    }
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;

    fn make_cmd(
        g: Option<u32>,
        m: Option<u32>,
        x: Option<f64>,
        y: Option<f64>,
        z: Option<f64>,
    ) -> GCodeCommand {
        GCodeCommand {
            kind: CommandKind::Unknown,
            g_code: g,
            m_code: m,
            x,
            y,
            z,
            i: None,
            j: None,
            k: None,
            r: None,
            f: None,
            s: None,
            p: None,
            t: None,
            line: 0,
        }
    }

    fn make_arc_cmd(
        g: u32,
        x: f64,
        y: f64,
        i: Option<f64>,
        j: Option<f64>,
        r: Option<f64>,
    ) -> GCodeCommand {
        let mut cmd = make_cmd(Some(g), None, Some(x), Some(y), None);
        cmd.kind = CommandKind::Motion;
        cmd.i = i;
        cmd.j = j;
        cmd.r = r;
        cmd
    }

    #[test]
    fn test_modal_defaults() {
        let m = ModalState::new();
        assert_eq!(m.motion_mode, 0); // G0
        assert_eq!(m.coord_mode, 90); // G90
        assert_eq!(m.unit_mode, 21); // G21 mm
        assert_eq!(m.plane, 17); // G17 XY
        assert_eq!(m.feedrate, 0.0);
        assert_eq!(m.current_x, 0.0);
    }

    #[test]
    fn test_g90_to_g91() {
        let m = ModalState::new();
        // G91 incremental mode
        let cmd = make_cmd(Some(91), None, None, None, None);
        let cmd = GCodeCommand { kind: CommandKind::Modal, ..cmd };
        let m2 = m.advance(&cmd);
        assert_eq!(m2.coord_mode, 91);
    }

    #[test]
    fn test_feedrate_inheritance() {
        let m = ModalState::new();
        let cmd = GCodeCommand {
            kind: CommandKind::Motion,
            g_code: Some(1),
            f: Some(200.0),
            x: Some(10.0),
            ..make_cmd(Some(1), None, Some(10.0), None, None)
        };
        let m2 = m.advance(&cmd);
        assert!((m2.feedrate - 200.0).abs() < 0.001);
    }

    #[test]
    fn test_g0_single_axis() {
        let m = ModalState::new();
        let cmd = GCodeCommand {
            kind: CommandKind::Motion,
            g_code: Some(0),
            x: Some(50.0),
            ..make_cmd(Some(0), None, Some(50.0), None, None)
        };
        let program = compile_commands(&[cmd], &m).unwrap();
        assert!(program.instructions.len() > 1);
        // Should have Store to axis.0.pos
        let has_store = program.instructions.iter().any(|inst| {
            inst.opcode == Opcode::Store
                && inst.operands.first()
                    == Some(&audesys_hal_ir::types::Operand::SignalName("axis.0.pos".into()))
        });
        assert!(has_store);
    }

    #[test]
    fn test_g0_multi_axis() {
        let m = ModalState::new();
        let cmd = GCodeCommand {
            kind: CommandKind::Motion,
            g_code: Some(0),
            x: Some(10.0),
            y: Some(20.0),
            z: Some(30.0),
            ..make_cmd(Some(0), None, Some(10.0), Some(20.0), Some(30.0))
        };
        let program = compile_commands(&[cmd], &m).unwrap();
        assert!(program.instructions.len() > 3);
        // Should store all three axes
        let has_x = program.instructions.iter().any(|inst| {
            inst.opcode == Opcode::Store
                && inst.operands.first()
                    == Some(&audesys_hal_ir::types::Operand::SignalName("axis.0.pos".into()))
        });
        let has_y = program.instructions.iter().any(|inst| {
            inst.opcode == Opcode::Store
                && inst.operands.first()
                    == Some(&audesys_hal_ir::types::Operand::SignalName("axis.1.pos".into()))
        });
        let has_z = program.instructions.iter().any(|inst| {
            inst.opcode == Opcode::Store
                && inst.operands.first()
                    == Some(&audesys_hal_ir::types::Operand::SignalName("axis.2.pos".into()))
        });
        assert!(has_x);
        assert!(has_y);
        assert!(has_z);
    }

    #[test]
    fn test_g1_single_axis() {
        let m = ModalState::new();
        let cmd = GCodeCommand {
            kind: CommandKind::Motion,
            g_code: Some(1),
            x: Some(10.0),
            f: Some(300.0),
            ..make_cmd(Some(1), None, Some(10.0), None, None)
        };
        let program = compile_commands(&[cmd], &m).unwrap();
        // G1 should emit a loop with jump_if
        let has_jump_if = program.instructions.iter().any(|inst| inst.opcode == Opcode::JumpIf);
        let has_loop = program.instructions.iter().any(|inst| inst.opcode == Opcode::Add);
        assert!(has_jump_if, "G1 should emit a counter loop with JumpIf");
        assert!(has_loop, "G1 should emit Add for step accumulation");
    }

    #[test]
    fn test_g1_multi_axis() {
        let m = ModalState::new();
        let cmd = GCodeCommand {
            kind: CommandKind::Motion,
            g_code: Some(1),
            x: Some(100.0),
            y: Some(50.0),
            f: Some(200.0),
            ..make_cmd(Some(1), None, Some(100.0), Some(50.0), None)
        };
        let program = compile_commands(&[cmd], &m).unwrap();
        assert!(program.instructions.iter().any(|inst| inst.opcode == Opcode::JumpIf));
        // Both axis stores should be present
        let store_count =
            program.instructions.iter().filter(|inst| inst.opcode == Opcode::Store).count();
        assert!(store_count >= 2);
    }

    #[test]
    fn test_g2_quadrant_arc() {
        // G2 CW arc: start (10,0), end (0,10), center (0,0) via I-10 J0
        let m = ModalState::new();
        let cmd = make_arc_cmd(2, 0.0, 10.0, Some(-10.0), Some(0.0), None);
        let program = compile_commands(&[cmd], &m).unwrap();
        // Should emit Store opcodes (no Nop)
        let has_store = program.instructions.iter().any(|inst| inst.opcode == Opcode::Store);
        let has_nop = program.instructions.iter().any(|inst| inst.opcode == Opcode::Nop);
        assert!(has_store, "G2 quadrant arc should emit Store instructions");
        // Nop from init only (REG_ONE load has no Nop), not from motion emission
        assert!(!has_nop || {
            program.instructions.iter().filter(|i| i.opcode == Opcode::Nop).count() == 0
            // if any Nop exists, fail with details
        });
        // Verify stores to axis signals exist
        let has_x = program.instructions.iter().any(|inst| {
            inst.opcode == Opcode::Store
                && inst.operands.first()
                    == Some(&audesys_hal_ir::types::Operand::SignalName("axis.0.pos".into()))
        });
        assert!(has_x, "G2 arc should store axis.0.pos");
    }

    #[test]
    fn test_g3_quadrant_arc() {
        // G3 CCW arc: start (10,0), end (0,10), center (0,0) via I-10 J0
        let m = ModalState::new();
        let cmd = make_arc_cmd(3, 0.0, 10.0, Some(-10.0), Some(0.0), None);
        let program = compile_commands(&[cmd], &m).unwrap();
        let has_store = program.instructions.iter().any(|inst| inst.opcode == Opcode::Store);
        assert!(has_store, "G3 quadrant arc should emit Store instructions");
    }

    #[test]
    fn test_g2_full_circle() {
        // G2 CW full circle: start (0,0), end (0,0), center (5,0) via I5 J0
        let m = ModalState::new();
        let cmd = make_arc_cmd(2, 0.0, 0.0, Some(5.0), Some(0.0), None);
        let program = compile_commands(&[cmd], &m).unwrap();
        let has_store = program.instructions.iter().any(|inst| inst.opcode == Opcode::Store);
        assert!(has_store, "G2 full circle should emit Store instructions");
        // Full circle should have many chord segments
        let store_count = program.instructions.iter().filter(|inst| inst.opcode == Opcode::Store).count();
        assert!(store_count >= 18, "Full circle should have many chord segments, got {}", store_count);
    }

    #[test]
    fn test_g2_helical() {
        // G2 CW helical: arc in XY with Z rise
        let m = ModalState::new();
        let mut cmd = make_arc_cmd(2, 0.0, 10.0, Some(-10.0), Some(0.0), None);
        cmd.z = Some(5.0);
        let program = compile_commands(&[cmd], &m).unwrap();
        let has_z = program.instructions.iter().any(|inst| {
            inst.opcode == Opcode::Store
                && inst.operands.first()
                    == Some(&audesys_hal_ir::types::Operand::SignalName("axis.2.pos".into()))
        });
        assert!(has_z, "G2 helical should store Z axis");
    }

    #[test]
    fn test_g2_r_format() {
        // G2 CW arc via R: start (0,0), end (10,10), radius R=10
        let m = ModalState::new();
        let cmd = make_arc_cmd(2, 10.0, 10.0, None, None, Some(10.0));
        let program = compile_commands(&[cmd], &m).unwrap();
        let has_store = program.instructions.iter().any(|inst| inst.opcode == Opcode::Store);
        assert!(has_store, "G2 R-format arc should emit Store instructions");
    }

    #[test]
    fn test_g18_plane_arc() {
        // G18 ZX plane: G3 CCW arc from (Z=10,X=0) to (Z=0,X=10) with center (0,0)
        let mut m = ModalState::new();
        // Set G18 plane
        let g18 = GCodeCommand {
            kind: CommandKind::Modal,
            g_code: Some(18),
            ..make_cmd(Some(18), None, None, None, None)
        };
        m = m.advance(&g18);
        // Move to start position Z=10, X=0
        let move_start = GCodeCommand {
            kind: CommandKind::Motion,
            g_code: Some(0),
            z: Some(10.0),
            x: Some(0.0),
            ..make_cmd(Some(0), None, None, None, Some(10.0))
        };
        // ponytail: mock command with x=0 for start pos
        let mut move_start = move_start;
        move_start.x = Some(0.0);
        m = m.advance(&move_start);

        let mut cmd = make_cmd(Some(3), None, Some(10.0), Some(0.0), Some(0.0));
        cmd.kind = CommandKind::Motion;
        cmd.z = Some(0.0);
        cmd.k = Some(-10.0);
        cmd.i = Some(0.0);
        let program = compile_commands(&[cmd], &m).unwrap();
        let has_store = program.instructions.iter().any(|inst| inst.opcode == Opcode::Store);
        assert!(has_store, "G18 arc should emit Store instructions");
    }

    #[test]
    fn test_zero_radius_error() {
        // I=0 J=0 with start ≠ end should be valid (center = start, radius = 0)
        // ponytail: radius < 1e-9 from center = start is an error
        let m = ModalState::new();
        let cmd = make_arc_cmd(2, 10.0, 0.0, Some(0.0), Some(0.0), None);
        let result = compile_commands(&[cmd], &m);
        assert!(result.is_err(), "Zero-radius arc should error");
    }

    #[test]
    fn test_arc_missing_ijk_r() {
        let m = ModalState::new();
        let cmd = make_arc_cmd(2, 10.0, 10.0, None, None, None);
        let result = compile_commands(&[cmd], &m);
        assert!(result.is_err(), "Arc missing I/J/K or R should error");
    }

    #[test]
    fn test_m3_spindle_cw() {
        let m = ModalState::new();
        let cmd = GCodeCommand {
            kind: CommandKind::Spindle,
            m_code: Some(3),
            s: Some(1000.0),
            ..make_cmd(None, Some(3), None, None, None)
        };
        let program = compile_commands(&[cmd], &m).unwrap();
        let has_cw = program.instructions.iter().any(|inst| {
            inst.opcode == Opcode::Store
                && inst.operands.first()
                    == Some(&audesys_hal_ir::types::Operand::SignalName("spindle.cw".into()))
        });
        assert!(has_cw);
    }

    #[test]
    fn test_m5_spindle_stop() {
        let m = ModalState::new();
        let cmd = GCodeCommand {
            kind: CommandKind::Spindle,
            m_code: Some(5),
            ..make_cmd(None, Some(5), None, None, None)
        };
        let program = compile_commands(&[cmd], &m).unwrap();
        // Should store false to spindle.cw and spindle.ccw
        let cw_off = program.instructions.iter().any(|inst| {
            inst.opcode == Opcode::Store
                && inst.operands.first()
                    == Some(&audesys_hal_ir::types::Operand::SignalName("spindle.cw".into()))
        });
        assert!(cw_off);
    }

    #[test]
    fn test_m30_halt() {
        let m = ModalState::new();
        let cmd = GCodeCommand {
            kind: CommandKind::ProgramControl,
            m_code: Some(30),
            ..make_cmd(None, Some(30), None, None, None)
        };
        let program = compile_commands(&[cmd], &m).unwrap();
        assert!(program.instructions.iter().any(|inst| inst.opcode == Opcode::Halt));
    }

    #[test]
    fn test_g20_to_g21_unit_change() {
        let m = ModalState::new();
        let cmd = GCodeCommand {
            kind: CommandKind::Modal,
            g_code: Some(20),
            ..make_cmd(Some(20), None, None, None, None)
        };
        let m2 = m.advance(&cmd);
        assert_eq!(m2.unit_mode, 20);
    }

    #[test]
    fn test_g17_to_g18_plane_change() {
        let m = ModalState::new();
        let cmd = GCodeCommand {
            kind: CommandKind::Modal,
            g_code: Some(18),
            ..make_cmd(Some(18), None, None, None, None)
        };
        let m2 = m.advance(&cmd);
        assert_eq!(m2.plane, 18);
    }

    #[test]
    fn test_g80_canned_cycle_cancel() {
        let m = ModalState::new();
        let cmd = GCodeCommand {
            kind: CommandKind::Modal,
            g_code: Some(80),
            ..make_cmd(Some(80), None, None, None, None)
        };
        let m2 = m.advance(&cmd);
        assert_eq!(m2.motion_mode, 0); // reset to G0
    }

    #[test]
    fn test_unsupported_motion_error() {
        let m = ModalState::new();
        let cmd = GCodeCommand {
            kind: CommandKind::Motion,
            g_code: Some(99),
            x: Some(10.0),
            ..make_cmd(Some(99), None, Some(10.0), None, None)
        };
        let result = compile_commands(&[cmd], &m);
        assert!(result.is_err());
    }

    #[test]
    fn test_g91_incremental() {
        let m = ModalState::new();
        // Set G91
        let g91 = GCodeCommand {
            kind: CommandKind::Modal,
            g_code: Some(91),
            ..make_cmd(Some(91), None, None, None, None)
        };
        let m = m.advance(&g91);
        // Move X+10 in incremental
        let move1 = GCodeCommand {
            kind: CommandKind::Motion,
            g_code: Some(0),
            x: Some(10.0),
            ..make_cmd(Some(0), None, Some(10.0), None, None)
        };
        let m = m.advance(&move1);
        assert!((m.current_x - 10.0).abs() < 0.001);
        // Move X+5 more
        let move2 = GCodeCommand {
            kind: CommandKind::Motion,
            g_code: Some(0),
            x: Some(5.0),
            ..make_cmd(Some(0), None, Some(5.0), None, None)
        };
        let m = m.advance(&move2);
        assert!((m.current_x - 15.0).abs() < 0.001);
    }

    #[test]
    fn test_signal_bindings_present() {
        let m = ModalState::new();
        let cmd = GCodeCommand {
            kind: CommandKind::Motion,
            g_code: Some(0),
            x: Some(5.0),
            ..make_cmd(Some(0), None, Some(5.0), None, None)
        };
        let program = compile_commands(&[cmd], &m).unwrap();
        let has_axis0 = program.signals.iter().any(|s| s.hal_signal_name == "axis.0.pos");
        assert!(has_axis0, "axis.0.pos should be declared");
    }
}
