//! G-code tokenizer for ISO 6983 / RS274.
//!
//! Converts raw G-code source text into a flat stream of [LexedToken] values.
//! Strips comments (parenthesized and semicolon-style), normalizes whitespace,
//! and handles line numbers, block delete, and program delimiters.

use crate::GCodeError;

/// All possible tokens in a G-code program.
#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    /// G-code word (G0, G1, G2, G3, G17, G18, G19, G20, G21, G80, G90, G91, ...)
    G(u32),
    /// M-code word (M3, M4, M5, M30, ...)
    M(u32),
    /// X axis position parameter
    X(f64),
    /// Y axis position parameter
    Y(f64),
    /// Z axis position parameter
    Z(f64),
    /// Arc center X offset (relative to start in G91.1, or absolute)
    I(f64),
    /// Arc center Y offset
    J(f64),
    /// Arc center Z offset
    K(f64),
    /// Radius value (for arcs or canned cycles)
    R(f64),
    /// Feedrate (mm/min or inch/min depending on G20/G21)
    F(f64),
    /// Spindle speed (RPM)
    S(f64),
    /// Tool number
    T(u32),
    /// Dwell time or other parameter
    P(f64),
    /// Line / sequence number (N...)
    LineNum(u32),
    /// Optional skip (`*` — optional block skip on key)
    Star,
    /// Program start / end delimiter (`%`)
    Percent,
    /// Block delete indicator (`/`)
    Slash,
    /// Logical end of line (inserted by tokenizer)
    EOL,
    /// End of file
    EOF,
}

/// A tokenized G-code element with optional numeric value and source line.
#[derive(Debug, Clone, PartialEq)]
pub struct LexedToken {
    pub token: Token,
    pub line: u32,
}

impl LexedToken {
    fn new(token: Token, line: u32) -> Self {
        LexedToken { token, line }
    }
}

/// Tokenize a G-code source string into a flat sequence of [LexedToken] values.
///
/// # Token stripping
/// - Parenthesized comments `(text)` are removed entirely (including nested).
/// - Semicolon comments `;text` are removed until end of line.
/// - Block delete `/` is emitted as a `Slash` token.
/// - Whitespace (spaces, tabs, CR) is ignored as token separators.
/// - Percent `%` delimiters are emitted but optional.
/// - `*` optional skip is emitted.
///
/// # Line tracking
/// Newlines (`\n`) produce `EOL` tokens and increment the line counter.
/// A final `EOF` token is always appended.
pub fn tokenize(source: &str) -> Result<Vec<LexedToken>, GCodeError> {
    let mut tokens: Vec<LexedToken> = Vec::new();
    let bytes = source.as_bytes();
    let mut i: usize = 0;
    let mut line: u32 = 1;

    while i < bytes.len() {
        match bytes[i] {
            b' ' | b'\t' | b'\r' => {
                i += 1;
            }
            b'\n' => {
                tokens.push(LexedToken::new(Token::EOL, line));
                line += 1;
                i += 1;
            }
            b'%' => {
                tokens.push(LexedToken::new(Token::Percent, line));
                i += 1;
            }
            b'*' => {
                tokens.push(LexedToken::new(Token::Star, line));
                i += 1;
            }
            b'/' => {
                tokens.push(LexedToken::new(Token::Slash, line));
                i += 1;
            }
            b'(' => {
                // Skip parenthesized comment with nesting support
                i += 1;
                let mut depth: u32 = 1;
                while i < bytes.len() && depth > 0 {
                    match bytes[i] {
                        b'(' => depth += 1,
                        b')' => depth -= 1,
                        b'\n' => line += 1,
                        _ => {}
                    }
                    i += 1;
                }
            }
            b';' => {
                // Skip until newline or EOF
                i += 1;
                while i < bytes.len() && bytes[i] != b'\n' {
                    i += 1;
                }
            }
            b'N' | b'n' => {
                i += 1;
                let num = parse_u32(bytes, &mut i);
                tokens.push(LexedToken::new(Token::LineNum(num), line));
            }
            b'G' | b'g' => {
                i += 1;
                let num = parse_u32(bytes, &mut i);
                tokens.push(LexedToken::new(Token::G(num), line));
            }
            b'M' | b'm' => {
                i += 1;
                let num = parse_u32(bytes, &mut i);
                tokens.push(LexedToken::new(Token::M(num), line));
            }
            b'X' | b'x' => {
                i += 1;
                let v = parse_f64(bytes, &mut i);
                tokens.push(LexedToken::new(Token::X(v), line));
            }
            b'Y' | b'y' => {
                i += 1;
                let v = parse_f64(bytes, &mut i);
                tokens.push(LexedToken::new(Token::Y(v), line));
            }
            b'Z' | b'z' => {
                i += 1;
                let v = parse_f64(bytes, &mut i);
                tokens.push(LexedToken::new(Token::Z(v), line));
            }
            b'I' | b'i' => {
                i += 1;
                let v = parse_f64(bytes, &mut i);
                tokens.push(LexedToken::new(Token::I(v), line));
            }
            b'J' | b'j' => {
                i += 1;
                let v = parse_f64(bytes, &mut i);
                tokens.push(LexedToken::new(Token::J(v), line));
            }
            b'K' | b'k' => {
                i += 1;
                let v = parse_f64(bytes, &mut i);
                tokens.push(LexedToken::new(Token::K(v), line));
            }
            b'R' | b'r' => {
                i += 1;
                let v = parse_f64(bytes, &mut i);
                tokens.push(LexedToken::new(Token::R(v), line));
            }
            b'F' | b'f' => {
                i += 1;
                let v = parse_f64(bytes, &mut i);
                tokens.push(LexedToken::new(Token::F(v), line));
            }
            b'S' | b's' => {
                i += 1;
                let v = parse_f64(bytes, &mut i);
                tokens.push(LexedToken::new(Token::S(v), line));
            }
            b'T' | b't' => {
                i += 1;
                let num = parse_u32(bytes, &mut i);
                tokens.push(LexedToken::new(Token::T(num), line));
            }
            b'P' | b'p' => {
                i += 1;
                let v = parse_f64(bytes, &mut i);
                tokens.push(LexedToken::new(Token::P(v), line));
            }
            // Unknown letter parameters — skip them silently
            b'A' | b'a' | b'B' | b'b' | b'C' | b'c' | b'D' | b'd' | b'E' | b'e' | b'H' | b'h'
            | b'L' | b'l' | b'Q' | b'q' | b'U' | b'u' | b'V' | b'v' | b'W' | b'w' => {
                i += 1;
                let _ = parse_f64(bytes, &mut i);
            }
            _ => {
                i += 1;
            }
        }
    }

    tokens.push(LexedToken::new(Token::EOF, line));
    Ok(tokens)
}

/// Parse an unsigned integer from bytes, advancing `i`.
fn parse_u32(bytes: &[u8], i: &mut usize) -> u32 {
    let mut val: u32 = 0;
    let mut has_digits = false;
    while *i < bytes.len() && bytes[*i].is_ascii_digit() {
        val = val.saturating_mul(10).saturating_add((bytes[*i] - b'0') as u32);
        has_digits = true;
        *i += 1;
    }
    // Skip optional fractional part (e.g., G1.0 → parse as G1)
    if *i < bytes.len() && bytes[*i] == b'.' {
        *i += 1;
        while *i < bytes.len() && bytes[*i].is_ascii_digit() {
            *i += 1;
        }
    }
    if !has_digits {
        // ponytail: letter without digits defaults to 0
        val = 0;
    }
    val
}

/// Parse a floating-point number from bytes, advancing `i`.
fn parse_f64(bytes: &[u8], i: &mut usize) -> f64 {
    let mut neg = false;
    if *i < bytes.len() && bytes[*i] == b'-' {
        neg = true;
        *i += 1;
    } else if *i < bytes.len() && bytes[*i] == b'+' {
        *i += 1;
    }

    let mut int_part: f64 = 0.0;
    let mut has_digits = false;
    while *i < bytes.len() && bytes[*i].is_ascii_digit() {
        int_part = int_part * 10.0 + (bytes[*i] - b'0') as f64;
        has_digits = true;
        *i += 1;
    }

    let mut frac_part: f64 = 0.0;
    if *i < bytes.len() && bytes[*i] == b'.' {
        *i += 1;
        let mut divisor: f64 = 10.0;
        while *i < bytes.len() && bytes[*i].is_ascii_digit() {
            frac_part += (bytes[*i] - b'0') as f64 / divisor;
            divisor *= 10.0;
            has_digits = true;
            *i += 1;
        }
    }

    if !has_digits {
        return 0.0;
    }

    let val = int_part + frac_part;
    if neg { -val } else { val }
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_single_g0() {
        let tokens = tokenize("G0 X10 Y20").unwrap();
        assert_eq!(tokens[0].token, Token::G(0));
        assert_eq!(tokens[1].token, Token::X(10.0));
        assert_eq!(tokens[2].token, Token::Y(20.0));
        assert!(matches!(tokens.last().unwrap().token, Token::EOF));
    }

    #[test]
    fn test_comment_stripping() {
        let tokens = tokenize("G1 X5 (this is a comment) Y10").unwrap();
        assert_eq!(tokens[0].token, Token::G(1));
        assert_eq!(tokens[1].token, Token::X(5.0));
        assert_eq!(tokens[2].token, Token::Y(10.0));
    }

    #[test]
    fn test_semicolon_comment() {
        let tokens = tokenize("G0 X0 ; move to origin\nG1 X10").unwrap();
        let g0_idx = tokens.iter().position(|t| t.token == Token::G(0)).unwrap();
        let eol_count = tokens.iter().filter(|t| t.token == Token::EOL).count();
        assert_eq!(tokens[g0_idx + 1].token, Token::X(0.0));
        assert!(eol_count >= 1);
    }

    #[test]
    fn test_line_numbers() {
        let tokens = tokenize("N10 G0 X0\nN20 G1 X10").unwrap();
        assert_eq!(tokens[0].token, Token::LineNum(10));
        assert_eq!(tokens[1].token, Token::G(0));
        assert_eq!(tokens[2].token, Token::X(0.0));
        assert!(tokens.iter().any(|t| t.token == Token::LineNum(20)));
    }

    #[test]
    fn test_multi_line() {
        let tokens = tokenize("G0 X0 Y0\nG1 X10 Y20 F100\nM30").unwrap();
        let eol_count = tokens.iter().filter(|t| t.token == Token::EOL).count();
        assert_eq!(eol_count, 2);
        assert!(tokens.iter().any(|t| t.token == Token::G(0)));
        assert!(tokens.iter().any(|t| t.token == Token::G(1)));
        assert!(tokens.iter().any(|t| matches!(t.token, Token::F(v) if (v - 100.0).abs() < 0.001)));
        assert!(tokens.iter().any(|t| t.token == Token::M(30)));
        assert!(matches!(tokens.last().unwrap().token, Token::EOF));
    }

    #[test]
    fn test_percent_delimiters() {
        let tokens = tokenize("%\nG0 X0\n%").unwrap();
        assert_eq!(tokens[0].token, Token::Percent);
        let mid_percent = tokens.iter().position(|t| t.token == Token::Percent && t.line == 3);
        assert!(mid_percent.is_some());
    }

    #[test]
    fn test_block_delete() {
        let tokens = tokenize("/ G0 X10").unwrap();
        assert_eq!(tokens[0].token, Token::Slash);
    }

    #[test]
    fn test_nested_comments() {
        let tokens = tokenize("G0 (outer(inner)still) X10").unwrap();
        assert_eq!(tokens[0].token, Token::G(0));
        assert_eq!(tokens[1].token, Token::X(10.0));
    }

    #[test]
    fn test_fractional_gcode() {
        let tokens = tokenize("G1.0 X5.5").unwrap();
        assert_eq!(tokens[0].token, Token::G(1)); // fractional part dropped
        let x_val = match tokens[1].token {
            Token::X(v) => v,
            _ => panic!("expected X"),
        };
        assert!((x_val - 5.5).abs() < 0.001);
    }

    #[test]
    fn test_negative_values() {
        let tokens = tokenize("G1 X-5.0 Y-10.0").unwrap();
        let x_val = match tokens[1].token {
            Token::X(v) => v,
            _ => panic!("expected X"),
        };
        assert!((x_val - (-5.0)).abs() < 0.001);
    }

    #[test]
    fn test_spindle_codes() {
        let tokens = tokenize("M3 S1000\nM5").unwrap();
        assert!(tokens.iter().any(|t| t.token == Token::M(3)));
        assert!(
            tokens.iter().any(|t| matches!(t.token, Token::S(v) if (v - 1000.0).abs() < 0.001))
        );
        assert!(tokens.iter().any(|t| t.token == Token::M(5)));
    }

    #[test]
    fn test_arc_tokens() {
        let tokens = tokenize("G2 X10 Y10 I5 J0").unwrap();
        assert_eq!(tokens[0].token, Token::G(2));
        assert!(tokens.iter().any(|t| matches!(t.token, Token::I(v) if (v - 5.0).abs() < 0.001)));
        assert!(tokens.iter().any(|t| matches!(t.token, Token::J(v) if (v - 0.0).abs() < 0.001)));
    }
}
