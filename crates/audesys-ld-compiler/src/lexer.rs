//! LD lexer — tokenize LD text format into tokens.
//!
//! LD text format:
//!   NETWORK       — start a new network (rung)
//!   NO var        — normally open contact
//!   NC var        — normally closed contact
//!   OUT var       — output coil
//!   SET var       — set (latch) coil
//!   RESET var     — reset (unlatch) coil

/// Token in the LD text format.
#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    Network,
    No(String),
    Nc(String),
    Out(String),
    Set(String),
    Reset(String),
}

/// Tokenize LD source text into a vector of tokens.
///
/// Each line becomes one token (or empty lines are skipped).
pub fn tokenize(source: &str) -> Vec<Token> {
    let mut tokens = Vec::new();
    for line in source.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let token = parse_line(trimmed);
        tokens.push(token);
    }
    tokens
}

fn parse_line(line: &str) -> Token {
    let upper = line.to_uppercase();
    let parts: Vec<&str> = upper.split_whitespace().collect();
    match parts.as_slice() {
        ["NETWORK"] => Token::Network,
        ["NO", var] => Token::No(var.to_string()),
        ["NC", var] => Token::Nc(var.to_string()),
        ["OUT", var] => Token::Out(var.to_string()),
        ["SET", var] => Token::Set(var.to_string()),
        ["RESET", var] => Token::Reset(var.to_string()),
        _ => Token::Network, // ponytail: treat unknown lines as network boundary
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tokenize_empty() {
        let tokens = tokenize("");
        assert!(tokens.is_empty());
    }

    #[test]
    fn test_tokenize_simple_network() {
        let src = "NETWORK\n  NO X1\n  NO X2\n  OUT Y1";
        let tokens = tokenize(src);
        assert_eq!(tokens.len(), 4);
        assert_eq!(tokens[0], Token::Network);
        assert_eq!(tokens[1], Token::No("X1".into()));
        assert_eq!(tokens[2], Token::No("X2".into()));
        assert_eq!(tokens[3], Token::Out("Y1".into()));
    }

    #[test]
    fn test_tokenize_nc() {
        let src = "NETWORK\n  NC X1\n  OUT Y1";
        let tokens = tokenize(src);
        assert_eq!(tokens.len(), 3);
        assert_eq!(tokens[1], Token::Nc("X1".into()));
    }

    #[test]
    fn test_tokenize_set_reset() {
        let src = "NETWORK\n  NO X1\n  SET Y1\n  NETWORK\n  NO X2\n  RESET Y1";
        let tokens = tokenize(src);
        assert_eq!(tokens.len(), 6);
        assert_eq!(tokens[2], Token::Set("Y1".into()));
        assert_eq!(tokens[5], Token::Reset("Y1".into()));
    }

    #[test]
    fn test_tokenize_multiple_networks() {
        let src = "NETWORK\n  NO X1\n  OUT Y1\n\nNETWORK\n  NO X2\n  OUT Y2";
        let tokens = tokenize(src);
        assert_eq!(tokens.len(), 6);
        assert_eq!(tokens[3], Token::Network);
    }

    #[test]
    fn test_case_insensitive() {
        let src = "network\n  no x1\n  nc x2\n  out y1\n  set y2\n  reset y3";
        let tokens = tokenize(src);
        assert_eq!(tokens.len(), 6);
        assert_eq!(tokens[1], Token::No("X1".into()));
        assert_eq!(tokens[2], Token::Nc("X2".into()));
        assert_eq!(tokens[3], Token::Out("Y1".into()));
        assert_eq!(tokens[4], Token::Set("Y2".into()));
        assert_eq!(tokens[5], Token::Reset("Y3".into()));
    }
}
