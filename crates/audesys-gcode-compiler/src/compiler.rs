//! G-code IR compiler — converts [GCodeCommand] lines to [HalProgram].
//!
//! Uses modal state tracking (G90/G91 relative, G0/G1/G2/G3 motion mode,
//! G20/G21 units, G17/G18/G19 plane) to generate register-VM instructions
//! for motion, spindle, and program control.

use crate::parser::{CommandKind, GCodeCommand};
use crate::GCodeError;
use audesys_hal_core::types::HalPinType;
use audesys_hal_core::HalValue;
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
            motion_mode: 0,      // G0 (rapid) default
            coord_mode: 90,       // G90 (absolute)
            unit_mode: 21,        // G21 (mm)
            plane: 17,            // G17 (XY)
            feedrate: 0.0,
            spindle_rpm: 0.0,
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
            // ponytail: G2/G3 Phase 1 parse-only — emit Nop + comment
            instructions.push(Instruction::nop());
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

/// G1 linear interpolation: step-per-cycle loop.
///
/// Computes distance, step size per 10ms cycle, and emits a counter-based
/// loop that updates axis positions incrementally each scan cycle.
fn emit_g1(prev: &ModalState, next: &ModalState, instructions: &mut Vec<Instruction>) {
    let dx = next.current_x - prev.current_x;
    let dy = next.current_y - prev.current_y;
    let dz = next.current_z - prev.current_z;

    let distance = (dx * dx + dy * dy + dz * dz).sqrt();
    if distance < 1e-9 {
        return; // no movement
    }

    let feedrate = if next.feedrate > 0.0 { next.feedrate } else { 100.0 };
    // ponytail: 10ms scan cycle hardcoded
    let scan_seconds = 0.01;
    let time_seconds = distance / (feedrate / 60.0);
    // ponytail: minimum 1 cycle to avoid zero-division in step calc
    let cycles: u32 = (time_seconds / scan_seconds).ceil().max(1.0) as u32;
    let step_x = dx / cycles as f64;
    let step_y = dy / cycles as f64;
    let step_z = dz / cycles as f64;

    // Load counter
    instructions.push(Instruction::load_imm(REG_COUNTER, HalValue::F64(cycles as f64)));

    // Load step sizes
    instructions.push(Instruction::load_imm(REG_STEP, HalValue::F64(step_x)));
    // Initialize position register with start position
    instructions.push(Instruction::load_imm(REG_POS_X, HalValue::F64(prev.current_x)));

    if dy.abs() > 1e-9 {
        instructions.push(Instruction::load_imm(REG_POS_Y, HalValue::F64(prev.current_y)));
    }
    if dz.abs() > 1e-9 {
        instructions.push(Instruction::load_imm(REG_POS_Z, HalValue::F64(prev.current_z)));
    }

    // --- Loop start (ponytail: label by instruction index) ---
    let loop_start = instructions.len() as u32;

    // Add step to X: r2 = r2 + r0
    instructions.push(Instruction::arith(Opcode::Add, REG_POS_X, REG_STEP, REG_POS_X));
    // Store X to signal
    instructions.push(Instruction::new(
        Opcode::Store,
        vec![
            audesys_hal_ir::types::Operand::SignalName("axis.0.pos".into()),
            audesys_hal_ir::types::Operand::Register(REG_POS_X),
        ],
    ));

    if dy.abs() > 1e-9 {
        instructions.push(Instruction::load_imm(
            REG_STEP,
            HalValue::F64(step_y),
        ));
        instructions.push(Instruction::arith(Opcode::Add, REG_POS_Y, REG_STEP, REG_POS_Y));
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                audesys_hal_ir::types::Operand::SignalName("axis.1.pos".into()),
                audesys_hal_ir::types::Operand::Register(REG_POS_Y),
            ],
        ));
        // Reload step_x into r0 for next iteration
        instructions.push(Instruction::load_imm(REG_STEP, HalValue::F64(step_x)));
    }

    if dz.abs() > 1e-9 {
        instructions.push(Instruction::load_imm(
            REG_STEP,
            HalValue::F64(step_z),
        ));
        instructions.push(Instruction::arith(Opcode::Add, REG_POS_Z, REG_STEP, REG_POS_Z));
        instructions.push(Instruction::new(
            Opcode::Store,
            vec![
                audesys_hal_ir::types::Operand::SignalName("axis.2.pos".into()),
                audesys_hal_ir::types::Operand::Register(REG_POS_Z),
            ],
        ));
        instructions.push(Instruction::load_imm(REG_STEP, HalValue::F64(step_x)));
    }

    // Decrement counter: r1 = r1 - 1.0
    instructions.push(Instruction::arith(Opcode::Sub, REG_COUNTER, REG_ONE, REG_COUNTER));
    // Compare r1 > 0 (r5 = 0.0)
    instructions.push(Instruction::cmp(Opcode::Gt, REG_COUNTER, REG_ZERO));
    // Jump if r1 > 0
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
        let cmd = GCodeCommand {
            kind: CommandKind::Modal,
            ..cmd
        };
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
                    == Some(&audesys_hal_ir::types::Operand::SignalName(
                        "axis.0.pos".into(),
                    ))
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
                    == Some(&audesys_hal_ir::types::Operand::SignalName(
                        "axis.0.pos".into(),
                    ))
        });
        let has_y = program.instructions.iter().any(|inst| {
            inst.opcode == Opcode::Store
                && inst.operands.first()
                    == Some(&audesys_hal_ir::types::Operand::SignalName(
                        "axis.1.pos".into(),
                    ))
        });
        let has_z = program.instructions.iter().any(|inst| {
            inst.opcode == Opcode::Store
                && inst.operands.first()
                    == Some(&audesys_hal_ir::types::Operand::SignalName(
                        "axis.2.pos".into(),
                    ))
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
        let has_loop = program
            .instructions
            .iter()
            .any(|inst| inst.opcode == Opcode::Add);
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
        let store_count = program.instructions.iter().filter(|inst| inst.opcode == Opcode::Store).count();
        assert!(store_count >= 2);
    }

    #[test]
    fn test_g2_parse_only() {
        let m = ModalState::new();
        let cmd = GCodeCommand {
            kind: CommandKind::Motion,
            g_code: Some(2),
            x: Some(10.0),
            y: Some(0.0),
            i: Some(5.0),
            j: Some(0.0),
            ..make_cmd(Some(2), None, Some(10.0), Some(0.0), None)
        };
        let program = compile_commands(&[cmd], &m).unwrap();
        // Should contain Nop for G2 (parse-only)
        assert!(program
            .instructions
            .iter()
            .any(|inst| inst.opcode == Opcode::Nop));
    }

    #[test]
    fn test_g3_parse_only() {
        let m = ModalState::new();
        let cmd = GCodeCommand {
            kind: CommandKind::Motion,
            g_code: Some(3),
            x: Some(-10.0),
            y: Some(0.0),
            i: Some(5.0),
            ..make_cmd(Some(3), None, Some(-10.0), Some(0.0), None)
        };
        let program = compile_commands(&[cmd], &m).unwrap();
        assert!(program
            .instructions
            .iter()
            .any(|inst| inst.opcode == Opcode::Nop));
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
                    == Some(&audesys_hal_ir::types::Operand::SignalName(
                        "spindle.cw".into(),
                    ))
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
                    == Some(&audesys_hal_ir::types::Operand::SignalName(
                        "spindle.cw".into(),
                    ))
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
