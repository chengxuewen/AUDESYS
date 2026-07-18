//! IL lexer — tokenize line-oriented IL source.
use std::fmt;

#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    Ld,
    Ldn,
    St,
    And,
    Andn,
    Or,
    Orn,
    Xor,
    Add,
    Sub,
    Mul,
    Div,
    Gt,
    Ge,
    Eq,
    Ne,
    Le,
    Lt,
    Jmp,
    Jmpc,
    Jmpcn,
    Cal,
    Ret,
    Ident(String),
    Label(String),
}

impl fmt::Display for Token {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Token::Ld => write!(f, "LD"),
            Token::Ldn => write!(f, "LDN"),
            Token::St => write!(f, "ST"),
            Token::And => write!(f, "AND"),
            Token::Andn => write!(f, "ANDN"),
            Token::Or => write!(f, "OR"),
            Token::Orn => write!(f, "ORN"),
            Token::Xor => write!(f, "XOR"),
            Token::Add => write!(f, "ADD"),
            Token::Sub => write!(f, "SUB"),
            Token::Mul => write!(f, "MUL"),
            Token::Div => write!(f, "DIV"),
            Token::Gt => write!(f, "GT"),
            Token::Ge => write!(f, "GE"),
            Token::Eq => write!(f, "EQ"),
            Token::Ne => write!(f, "NE"),
            Token::Le => write!(f, "LE"),
            Token::Lt => write!(f, "LT"),
            Token::Jmp => write!(f, "JMP"),
            Token::Jmpc => write!(f, "JMPC"),
            Token::Jmpcn => write!(f, "JMPCN"),
            Token::Cal => write!(f, "CAL"),
            Token::Ret => write!(f, "RET"),
            Token::Ident(name) => write!(f, "{name}"),
            Token::Label(name) => write!(f, "{name}:"),
        }
    }
}

fn remove_inline_comments(line: &str) -> String {
    let mut result = String::new();
    let mut in_comment = false;
    let chars: Vec<char> = line.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if i + 1 < chars.len() && chars[i] == '(' && chars[i + 1] == '*' {
            in_comment = true;
            i += 2;
            continue;
        }
        if in_comment && i + 1 < chars.len() && chars[i] == '*' && chars[i + 1] == ')' {
            in_comment = false;
            i += 2;
            continue;
        }
        if !in_comment {
            result.push(chars[i]);
        }
        i += 1;
    }
    result
}
fn parse_mnemonic(s: &str) -> Option<Token> {
    Some(match s {
        "LD" => Token::Ld,
        "LDN" => Token::Ldn,
        "ST" => Token::St,
        "AND" => Token::And,
        "ANDN" => Token::Andn,
        "OR" => Token::Or,
        "ORN" => Token::Orn,
        "XOR" => Token::Xor,
        "ADD" => Token::Add,
        "SUB" => Token::Sub,
        "MUL" => Token::Mul,
        "DIV" => Token::Div,
        "GT" => Token::Gt,
        "GE" => Token::Ge,
        "EQ" => Token::Eq,
        "NE" => Token::Ne,
        "LE" => Token::Le,
        "LT" => Token::Lt,
        "JMP" => Token::Jmp,
        "JMPC" => Token::Jmpc,
        "JMPCN" => Token::Jmpcn,
        "CAL" => Token::Cal,
        "RET" => Token::Ret,
        _ => return None,
    })
}

/// Tokenize IL source into a flat token stream.

/// Tokenize IL source into a flat token stream.
pub fn tokenize(source: &str) -> Vec<Token> {
    let mut tokens = Vec::new();
    for line in source.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("(*") {
            continue;
        }
        let code = remove_inline_comments(trimmed);
        let parts: Vec<&str> = code.split_whitespace().collect();
        if parts.is_empty() {
            continue;
        }

        // Check for label first (before uppercasing, to preserve case)
        if parts[0].ends_with(':') {
            let label_name = parts[0][..parts[0].len() - 1].to_string();
            tokens.push(Token::Label(label_name));
            // Process remaining parts on the same line as normal tokens
            for part in &parts[1..] {
                let upper = part.to_uppercase();
                if let Some(tok) = parse_mnemonic(&upper) {
                    tokens.push(tok);
                } else {
                    tokens.push(Token::Ident(part.to_string()));
                }
            }
        }

        let mnemonic = parts[0].to_uppercase();
        let token = match parse_mnemonic(&mnemonic) {
            Some(tok) => tok,
            None => continue,
        };
        tokens.push(token);
        if parts.len() >= 2 {
            let operand = parts[1];
            tokens.push(Token::Ident(operand.to_string()));
        }
    }
    tokens
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_tokens() {
        let src = "LD X1\nAND X2\nST Y1";
        let tokens = tokenize(src);
        assert_eq!(tokens[0], Token::Ld);
        assert_eq!(tokens[1], Token::Ident("X1".into()));
        assert_eq!(tokens[2], Token::And);
        assert_eq!(tokens[3], Token::Ident("X2".into()));
        assert_eq!(tokens[4], Token::St);
        assert_eq!(tokens[5], Token::Ident("Y1".into()));
        assert_eq!(tokens.len(), 6);
    }

    #[test]
    fn test_label() {
        let src = "start: LD X1";
        let tokens = tokenize(src);
        assert_eq!(tokens[0], Token::Label("start".into()));
        assert_eq!(tokens[1], Token::Ld);
        assert_eq!(tokens[2], Token::Ident("X1".into()));
    }

    #[test]
    fn test_comparison_tokens() {
        let src = "LD X1\nGT X2\nST Y1";
        let tokens = tokenize(src);
        assert_eq!(tokens[0], Token::Ld);
        assert_eq!(tokens[2], Token::Gt);
        assert_eq!(tokens[3], Token::Ident("X2".into()));
        assert_eq!(tokens[4], Token::St);
    }

    #[test]
    fn test_all_comparisons() {
        for mnemonic in &["GT", "GE", "EQ", "NE", "LE", "LT"] {
            let src = format!("LD X1\n{} X2", mnemonic);
            let tokens = tokenize(&src);
            assert_eq!(tokens.len(), 4, "failed for {mnemonic}");
            // tokens: [Ld, Ident(X1), Cmp, Ident(X2)]
            assert!(matches!(tokens[3], Token::Ident(ref s) if s == "X2"), "failed for {mnemonic}");
        }
    }

    #[test]
    fn test_jump_tokens() {
        let src = "JMP here\nJMPC there\nJMPCN somewhere";
        let tokens = tokenize(src);
        assert_eq!(tokens[0], Token::Jmp);
        assert_eq!(tokens[1], Token::Ident("here".into()));
        assert_eq!(tokens[2], Token::Jmpc);
        assert_eq!(tokens[3], Token::Ident("there".into()));
        assert_eq!(tokens[4], Token::Jmpcn);
        assert_eq!(tokens[5], Token::Ident("somewhere".into()));
    }

    #[test]
    fn test_case_insensitivity() {
        let src = "ld x1\nand x2\nst y1";
        let tokens = tokenize(src);
        assert_eq!(tokens[0], Token::Ld);
        assert_eq!(tokens[2], Token::And);
        assert_eq!(tokens[4], Token::St);
    }

    #[test]
    fn test_comment_removal() {
        let src = "LD X1 (* this is a comment *)";
        let tokens = tokenize(src);
        assert_eq!(tokens[0], Token::Ld);
        assert_eq!(tokens[1], Token::Ident("X1".into()));
        assert_eq!(tokens.len(), 2);
    }

    #[test]
    fn test_empty_lines() {
        let src = "\n\nLD X1\n\nST Y1\n\n";
        let tokens = tokenize(src);
        assert_eq!(tokens.len(), 4);
    }

    #[test]
    fn test_single_token_instructions() {
        let src = "RET";
        let tokens = tokenize(src);
        assert_eq!(tokens.len(), 1);
        assert_eq!(tokens[0], Token::Ret);
    }
}
