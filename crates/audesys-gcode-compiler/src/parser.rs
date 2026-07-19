//! Two-pass modal parser for G-code tokens.
//!
//! Groups a flat token stream into [GCodeCommand] lines, applying modal
//! inheritance so that parameters not specified on a line inherit values
//! from the current [ModalState].

use crate::GCodeError;
use crate::compiler::ModalState;
use crate::token::{LexedToken, Token};

/// Classifies a G-code command for compiler dispatch.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommandKind {
    /// Motion commands: G0, G1, G2, G3
    Motion,
    /// Spindle commands: M3, M4, M5
    Spindle,
    /// Modal state changes: G17-G19, G20-G21, G90-G91, G80
    Modal,
    /// Program flow: M2, M30
    ProgramControl,
    /// Unknown command
    Unknown,
}

/// A single G-code command (one logical block / line).
#[derive(Debug, Clone, PartialEq)]
pub struct GCodeCommand {
    /// Command classification
    pub kind: CommandKind,
    /// Active G-code (e.g., 0, 1, 2, 3, 17, 20, 90)
    pub g_code: Option<u32>,
    /// Active M-code (e.g., 3, 4, 5, 30)
    pub m_code: Option<u32>,
    /// X axis target (mm/inch)
    pub x: Option<f64>,
    /// Y axis target (mm/inch)
    pub y: Option<f64>,
    /// Z axis target (mm/inch)
    pub z: Option<f64>,
    /// Arc center X offset
    pub i: Option<f64>,
    /// Arc center Y offset
    pub j: Option<f64>,
    /// Arc center Z offset
    pub k: Option<f64>,
    /// Radius
    pub r: Option<f64>,
    /// Feedrate
    pub f: Option<f64>,
    /// Spindle speed (RPM)
    pub s: Option<f64>,
    /// Dwell / parameter
    pub p: Option<f64>,
    /// Tool number
    pub t: Option<u32>,
    /// Source line number
    pub line: u32,
}

impl GCodeCommand {
    fn new(line: u32) -> Self {
        GCodeCommand {
            kind: CommandKind::Unknown,
            g_code: None,
            m_code: None,
            x: None,
            y: None,
            z: None,
            i: None,
            j: None,
            k: None,
            r: None,
            f: None,
            s: None,
            p: None,
            t: None,
            line,
        }
    }

    /// Classify this command based on its G/M code.
    fn classify(&mut self) {
        self.kind = match (self.g_code, self.m_code) {
            (Some(0 | 1 | 2 | 3), _) => CommandKind::Motion,
            (_, Some(3 | 4 | 5)) => CommandKind::Spindle,
            (Some(17 | 18 | 19 | 20 | 21 | 80 | 90 | 91), _) => CommandKind::Modal,
            (_, Some(2 | 30)) => CommandKind::ProgramControl,
            _ => CommandKind::Unknown,
        };
    }
}

/// Parse a single line of G-code tokens into a [GCodeCommand].
///
/// Parameters not given on this line are `None` — the compiler applies
/// modal inheritance from [ModalState] during codegen.
pub fn parse_line(tokens: &[LexedToken], _modal: &ModalState) -> Result<GCodeCommand, GCodeError> {
    if tokens.is_empty() {
        // ponytail: empty line → no-op command with a dummy g-code
        let mut cmd = GCodeCommand::new(0);
        cmd.kind = CommandKind::Unknown;
        return Ok(cmd);
    }

    let line = tokens[0].line;
    let mut cmd = GCodeCommand::new(line);
    let mut has_content = false;

    for tok in tokens {
        match &tok.token {
            Token::G(n) => {
                cmd.g_code = Some(*n);
                has_content = true;
            }
            Token::M(n) => {
                cmd.m_code = Some(*n);
                has_content = true;
            }
            Token::X(v) => {
                cmd.x = Some(*v);
                has_content = true;
            }
            Token::Y(v) => {
                cmd.y = Some(*v);
                has_content = true;
            }
            Token::Z(v) => {
                cmd.z = Some(*v);
                has_content = true;
            }
            Token::I(v) => {
                cmd.i = Some(*v);
                has_content = true;
            }
            Token::J(v) => {
                cmd.j = Some(*v);
                has_content = true;
            }
            Token::K(v) => {
                cmd.k = Some(*v);
                has_content = true;
            }
            Token::R(v) => {
                cmd.r = Some(*v);
                has_content = true;
            }
            Token::F(v) => {
                cmd.f = Some(*v);
                has_content = true;
            }
            Token::S(v) => {
                cmd.s = Some(*v);
                has_content = true;
            }
            Token::P(v) => {
                cmd.p = Some(*v);
                has_content = true;
            }
            Token::T(n) => {
                cmd.t = Some(*n);
                has_content = true;
            }
            Token::LineNum(_) => {
                // consumed, not stored in command
            }
            Token::Star | Token::Slash | Token::Percent | Token::EOL | Token::EOF => {
                // ignored at parse level
            }
        }
    }

    if has_content {
        cmd.classify();
    } else {
        cmd.kind = CommandKind::Unknown;
    }

    Ok(cmd)
}

/// Split token stream by EOL/EOF into per-line slices, then parse each line.
pub fn parse_all(
    tokens: &[LexedToken],
    initial_modal: &ModalState,
) -> Result<Vec<GCodeCommand>, GCodeError> {
    let mut commands: Vec<GCodeCommand> = Vec::new();
    let mut start: usize = 0;

    for (i, tok) in tokens.iter().enumerate() {
        match &tok.token {
            Token::EOL | Token::EOF => {
                let line_tokens = &tokens[start..i];
                // Skip empty lines and lines that are only delimiters
                let has_words = line_tokens.iter().any(|t| {
                    matches!(
                        &t.token,
                        Token::G(_)
                            | Token::M(_)
                            | Token::X(_)
                            | Token::Y(_)
                            | Token::Z(_)
                            | Token::F(_)
                            | Token::S(_)
                            | Token::T(_)
                            | Token::P(_)
                            | Token::R(_)
                            | Token::I(_)
                            | Token::J(_)
                            | Token::K(_)
                    )
                });
                if has_words {
                    let cmd = parse_line(line_tokens, initial_modal)?;
                    commands.push(cmd);
                }
                start = i + 1;
                if matches!(&tok.token, Token::EOF) {
                    break;
                }
            }
            _ => {}
        }
    }

    Ok(commands)
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;

    fn lex(source: &str) -> Vec<LexedToken> {
        crate::token::tokenize(source).unwrap()
    }

    #[test]
    fn test_modal_inheritance_structure() {
        let modal = ModalState::new();
        let tokens = lex("G1 X10\nY20");
        // First line: G1 X10 → command has g_code=1, x=10, y=None
        // Second line: Y20 → command has no g_code, x=None, y=20 (modal inherits G1)
        let cmds = parse_all(&tokens, &modal).unwrap();
        assert_eq!(cmds.len(), 2);
        assert_eq!(cmds[0].g_code, Some(1));
        assert_eq!(cmds[0].x, Some(10.0));
        assert_eq!(cmds[1].g_code, None);
        assert_eq!(cmds[1].y, Some(20.0));
    }

    #[test]
    fn test_parameter_extraction() {
        let modal = ModalState::new();
        let tokens = lex("G1 X10.5 Y-2.0 Z3.0 F100 S500");
        let cmd = parse_line(&tokens, &modal).unwrap();
        assert_eq!(cmd.g_code, Some(1));
        assert!((cmd.x.unwrap() - 10.5).abs() < 0.001);
        assert!((cmd.y.unwrap() - (-2.0)).abs() < 0.001);
        assert!((cmd.z.unwrap() - 3.0).abs() < 0.001);
        assert!((cmd.f.unwrap() - 100.0).abs() < 0.001);
        assert!((cmd.s.unwrap() - 500.0).abs() < 0.001);
    }

    #[test]
    fn test_unknown_code_error_not_thrown() {
        // Unknown G-codes silently become Unknown kind — not an error
        let modal = ModalState::new();
        let tokens = lex("G99 X10");
        let cmd = parse_line(&tokens, &modal).unwrap();
        assert_eq!(cmd.kind, CommandKind::Unknown);
    }

    #[test]
    fn test_motion_classification() {
        let modal = ModalState::new();
        for g in &[0u32, 1, 2, 3] {
            let src = format!("G{} X10", g);
            let tokens = lex(&src);
            let cmd = parse_line(&tokens, &modal).unwrap();
            assert_eq!(cmd.kind, CommandKind::Motion, "G{} should be Motion", g);
        }
    }

    #[test]
    fn test_spindle_classification() {
        let modal = ModalState::new();
        for m in &[3u32, 4, 5] {
            let src = format!("M{} S500", m);
            let tokens = lex(&src);
            let cmd = parse_line(&tokens, &modal).unwrap();
            assert_eq!(cmd.kind, CommandKind::Spindle, "M{} should be Spindle", m);
        }
    }

    #[test]
    fn test_modal_classification() {
        let modal = ModalState::new();
        for g in &[17u32, 18, 19, 20, 21, 80, 90, 91] {
            let src = format!("G{}", g);
            let tokens = lex(&src);
            let cmd = parse_line(&tokens, &modal).unwrap();
            assert_eq!(cmd.kind, CommandKind::Modal, "G{} should be Modal", g);
        }
    }

    #[test]
    fn test_program_control_classification() {
        let modal = ModalState::new();
        for m in &[2u32, 30] {
            let src = format!("M{}", m);
            let tokens = lex(&src);
            let cmd = parse_line(&tokens, &modal).unwrap();
            assert_eq!(cmd.kind, CommandKind::ProgramControl, "M{} should be ProgramControl", m);
        }
    }

    #[test]
    fn test_line_number_ignored() {
        let modal = ModalState::new();
        let tokens = lex("N10 G1 X10");
        let cmd = parse_line(&tokens, &modal).unwrap();
        assert_eq!(cmd.g_code, Some(1));
        assert_eq!(cmd.x, Some(10.0));
    }

    #[test]
    fn test_empty_line() {
        let modal = ModalState::new();
        let cmd = parse_line(&[], &modal).unwrap();
        assert_eq!(cmd.kind, CommandKind::Unknown);
    }

    #[test]
    fn test_comment_only_lines_are_skipped() {
        let modal = ModalState::new();
        let tokens = lex("(comment only)\nG0 X0");
        let cmds = parse_all(&tokens, &modal).unwrap();
        assert_eq!(cmds.len(), 1);
        assert_eq!(cmds[0].g_code, Some(0));
    }
}
