//! AUDESYS G-code compiler — ISO 6983 / RS274 → HAL IR.
//!
//! Compiles RS274 G-code source text into a [HalProgram] for execution
//! on the AUDESYS register VM. Supports:
//!
//! - **Motion**: G0 (rapid), G1 (linear step-per-cycle), G2/G3 (parse-only)
//! - **Spindle**: M3 (CW), M4 (CCW), M5 (stop)
//! - **Modals**: G17-G19 (plane), G20-G21 (units), G90-G91 (coordinate), G80 (cancel)
//! - **Program**: M30 (halt)
//!
//! # Pipeline
//! ```text
//! source → tokenize() → parse_all() → compile_commands() → HalProgram
//! ```
//!
//! # Example
//! ```ignore
//! use audesys_gcode_compiler::gcode_compile;
//!
//! let src = "G0 X10 Y20\nM3 S1000\nG1 X50 F200\nM30";
//! let program = gcode_compile(src).unwrap();
//! assert!(program.is_well_formed());
//! ```

mod compiler;
mod parser;
mod token;

use audesys_hal_ir::program::HalProgram;

/// G-code compilation error.
#[derive(Debug)]
pub enum GCodeError {
    /// Syntax or tokenization error.
    ParseError {
        /// Source line where the error occurred
        line: u32,
        /// Human-readable description
        msg: String,
    },
    /// Unsupported G/M code encountered.
    UnsupportedCommand {
        /// Source line
        line: u32,
        /// The unsupported code (e.g., "G99")
        code: String,
    },
    /// Required parameter missing from a command.
    MissingParameter {
        /// Source line
        line: u32,
        /// Name of the missing parameter (e.g., "X")
        param: String,
    },
}

impl std::fmt::Display for GCodeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GCodeError::ParseError { line, msg } => {
                write!(f, "line {}: parse error: {}", line, msg)
            }
            GCodeError::UnsupportedCommand { line, code } => {
                write!(f, "line {}: unsupported command: {}", line, code)
            }
            GCodeError::MissingParameter { line, param } => {
                write!(f, "line {}: missing parameter: {}", line, param)
            }
        }
    }
}

impl std::error::Error for GCodeError {}

// Re-export for convenience
pub use compiler::ModalState;

/// Compile RS274 G-code source text to a HAL IR program.
///
/// # Pipeline
/// 1. `tokenize` — lexical analysis, comment stripping
/// 2. `parse_all` — group into per-line [GCodeCommand]s
/// 3. `compile_commands` — modal state tracking + IR emission
///
/// # Errors
/// Returns [GCodeError] on unsupported G/M codes or parse failures.
pub fn gcode_compile(source: &str) -> Result<HalProgram, GCodeError> {
    let tokens = token::tokenize(source)?;
    let initial_modal = ModalState::new();
    let commands = parser::parse_all(&tokens, &initial_modal)?;
    let program = compiler::compile_commands(&commands, &initial_modal)?;
    Ok(program)
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_program() {
        let result = gcode_compile("%");
        // Empty program compiles to a minimal program
        assert!(result.is_ok());
    }

    #[test]
    fn test_g0_rapid() {
        let src = "G0 X10 Y20 Z30";
        let program = gcode_compile(src).unwrap();
        assert!(program.instructions.len() > 1);
        assert!(program
            .instructions
            .iter()
            .any(|inst| inst.opcode == audesys_hal_ir::instruction::Opcode::Store));
    }

    #[test]
    fn test_full_pipeline() {
        let src = "\
G90 G21 G17
G0 X0 Y0 Z5
M3 S1000
G1 X100 Y50 F200
M5
M30";
        let program = gcode_compile(src).unwrap();
        assert!(program.instructions.len() > 5);
        assert!(program.is_well_formed());
    }

    #[test]
    fn test_spindle_control() {
        let src = "M3 S500\nG0 X10\nM5";
        let program = gcode_compile(src).unwrap();
        let spindle_signals: Vec<&str> = program
            .signals
            .iter()
            .map(|s| s.hal_signal_name.as_str())
            .filter(|n| n.starts_with("spindle"))
            .collect();
        assert!(!spindle_signals.is_empty());
    }

    #[test]
    fn test_unsupported_code() {
        let result = gcode_compile("G99 X10");
        assert!(result.is_err());
    }

    #[test]
    fn test_modal_switching() {
        let src = "G91\nG0 X10\nG0 X5\nM30";
        let program = gcode_compile(src).unwrap();
        assert!(program.is_well_formed());
        // Both G0 moves should emit instructions
        let store_count = program
            .instructions
            .iter()
            .filter(|inst| inst.opcode == audesys_hal_ir::instruction::Opcode::Store)
            .count();
        assert!(store_count >= 4); // pos + enable for each of 2 moves
    }

    #[test]
    fn test_m30_with_spindle_off() {
        let src = "M3 S1000\nM30";
        let program = gcode_compile(src).unwrap();
        // M30 should emit Halt
        assert!(program
            .instructions
            .iter()
            .any(|inst| inst.opcode == audesys_hal_ir::instruction::Opcode::Halt));
    }

    #[test]
    fn test_comment_heavy_program() {
        let src = "\
(Start of program)
G0 X0 Y0  ; go to origin
G1 X10    (move to X10)
M30       ; end";
        let program = gcode_compile(src).unwrap();
        assert!(program.is_well_formed());
    }

    #[test]
    fn test_line_numbers() {
        let src = "N10 G0 X0\nN20 G1 X10 F100\nN30 M30";
        let program = gcode_compile(src).unwrap();
        assert!(program.is_well_formed());
    }

    #[test]
    fn test_g1_step_per_cycle() {
        let src = "G1 X100 F300";
        let program = gcode_compile(src).unwrap();
        // G1 should emit a loop with JumpIf
        let has_jump_if = program
            .instructions
            .iter()
            .any(|inst| inst.opcode == audesys_hal_ir::instruction::Opcode::JumpIf);
        assert!(has_jump_if, "G1 should produce a step-per-cycle loop");
    }

    #[test]
    fn test_g2_g3_parse_only() {
        let src = "G2 X10 Y0 I5 J0\nG3 X0 Y10 I5 J5";
        let program = gcode_compile(src).unwrap();
        // Both should contain Nop for the parse-only arcs
        let nop_count = program
            .instructions
            .iter()
            .filter(|inst| inst.opcode == audesys_hal_ir::instruction::Opcode::Nop)
            .count();
        assert_eq!(nop_count, 2);
    }

    #[test]
    fn test_axis_signal_bindings() {
        let src = "G0 X10 Y20 Z30";
        let program = gcode_compile(src).unwrap();
        let signal_names: Vec<&str> = program
            .signals
            .iter()
            .map(|s| s.hal_signal_name.as_str())
            .collect();
        assert!(signal_names.contains(&"axis.0.pos"));
        assert!(signal_names.contains(&"axis.1.pos"));
        assert!(signal_names.contains(&"axis.2.pos"));
    }
}
