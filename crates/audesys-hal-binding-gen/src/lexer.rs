//! ST lexer — tokenizes IEC 61131-3 Structured Text source.
//! Phase 1: limited token set for simple ST programs.

/// Token produced by the lexer.
#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    // Keywords
    Program,
    EndProgram,
    Var,
    EndVar,
    If,
    Then,
    Else,
    EndIf,
    And,
    Or,
    Not,

    // Type keywords
    Int,
    Real,
    Bool,
    DInt,
    LReal,
    Byte,
    Word,
    DWord,

    // Operators
    Assign,    // :=
    Plus,      // +
    Minus,     // -
    Star,      // *
    Slash,     // /
    Equal,     // = (comparison)
    NotEqual,  // <>
    Greater,   // >
    Less,      // <
    GreaterEq, // >=
    LessEq,    // <=

    // Delimiters
    Semicolon, // ;
    Colon,     // :
    LParen,    // (
    RParen,    // )

    // Literals and identifiers
    Identifier(String),
    IntegerLiteral(i64),
    RealLiteral(f64),
}

/// Column/line position for error reporting.
#[derive(Debug, Clone, PartialEq)]
pub struct Span {
    pub line: usize,
    pub col: usize,
}

impl Span {
    pub fn new(line: usize, col: usize) -> Self {
        Span { line, col }
    }
}

/// Lexer error.
#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum LexError {
    #[error("unexpected character '{0}' at line {1}, col {2}")]
    UnexpectedChar(char, usize, usize),
    #[error("unterminated string at line {0}, col {1}")]
    UnterminatedString(usize, usize),
}

/// Token with its source position.
#[derive(Debug, Clone, PartialEq)]
pub struct TokenInfo {
    pub token: Token,
    pub span: Span,
}

impl TokenInfo {
    fn new(token: Token, line: usize, col: usize) -> Self {
        TokenInfo { token, span: Span::new(line, col) }
    }
}

/// Tokenize ST source into tokens, stripping whitespace and comments.
pub fn tokenize(source: &str) -> Result<Vec<TokenInfo>, LexError> {
    let mut tokens = Vec::new();
    let chars: Vec<char> = source.chars().collect();
    let len = chars.len();
    let mut pos = 0;
    let mut line = 1;
    let mut col = 1;

    while pos < len {
        let ch = chars[pos];
        let start_line = line;
        let start_col = col;

        match ch {
            // Whitespace
            '\n' => {
                line += 1;
                col = 1;
                pos += 1;
            }
            ' ' | '\r' | '\t' => {
                col += 1;
                pos += 1;
            }
            // Comments: (* ... *)
            '(' if pos + 1 < len && chars[pos + 1] == '*' => {
                pos += 2; // skip (*
                col += 2;
                let mut depth = 1usize;
                while pos < len && depth > 0 {
                    if chars[pos] == '(' && pos + 1 < len && chars[pos + 1] == '*' {
                        depth += 1;
                        pos += 2;
                        col += 2;
                    } else if chars[pos] == '*' && pos + 1 < len && chars[pos + 1] == ')' {
                        depth -= 1;
                        pos += 2;
                        col += 2;
                    } else if chars[pos] == '\n' {
                        line += 1;
                        col = 1;
                        pos += 1;
                    } else {
                        col += 1;
                        pos += 1;
                    }
                }
            }
            // Operators and delimiters
            ':' if pos + 1 < len && chars[pos + 1] == '=' => {
                tokens.push(TokenInfo::new(Token::Assign, start_line, start_col));
                pos += 2;
                col += 2;
            }
            ':' => {
                tokens.push(TokenInfo::new(Token::Colon, start_line, start_col));
                pos += 1;
                col += 1;
            }
            '<' if pos + 1 < len && chars[pos + 1] == '>' => {
                tokens.push(TokenInfo::new(Token::NotEqual, start_line, start_col));
                pos += 2;
                col += 2;
            }
            '<' if pos + 1 < len && chars[pos + 1] == '=' => {
                tokens.push(TokenInfo::new(Token::LessEq, start_line, start_col));
                pos += 2;
                col += 2;
            }
            '<' => {
                tokens.push(TokenInfo::new(Token::Less, start_line, start_col));
                pos += 1;
                col += 1;
            }
            '>' if pos + 1 < len && chars[pos + 1] == '=' => {
                tokens.push(TokenInfo::new(Token::GreaterEq, start_line, start_col));
                pos += 2;
                col += 2;
            }
            '>' => {
                tokens.push(TokenInfo::new(Token::Greater, start_line, start_col));
                pos += 1;
                col += 1;
            }
            '+' => {
                tokens.push(TokenInfo::new(Token::Plus, start_line, start_col));
                pos += 1;
                col += 1;
            }
            '-' => {
                tokens.push(TokenInfo::new(Token::Minus, start_line, start_col));
                pos += 1;
                col += 1;
            }
            '*' => {
                tokens.push(TokenInfo::new(Token::Star, start_line, start_col));
                pos += 1;
                col += 1;
            }
            '/' => {
                tokens.push(TokenInfo::new(Token::Slash, start_line, start_col));
                pos += 1;
                col += 1;
            }
            '=' => {
                tokens.push(TokenInfo::new(Token::Equal, start_line, start_col));
                pos += 1;
                col += 1;
            }
            ';' => {
                tokens.push(TokenInfo::new(Token::Semicolon, start_line, start_col));
                pos += 1;
                col += 1;
            }
            '(' => {
                tokens.push(TokenInfo::new(Token::LParen, start_line, start_col));
                pos += 1;
                col += 1;
            }
            ')' => {
                tokens.push(TokenInfo::new(Token::RParen, start_line, start_col));
                pos += 1;
                col += 1;
            }
            // Identifiers and keywords
            c if c.is_alphabetic() || c == '_' => {
                let mut ident = String::new();
                while pos < len && (chars[pos].is_alphanumeric() || chars[pos] == '_') {
                    ident.push(chars[pos]);
                    col += 1;
                    pos += 1;
                }
                let token = match_keyword(&ident);
                tokens.push(TokenInfo::new(token, start_line, start_col));
            }
            // Numbers
            c if c.is_ascii_digit() => {
                let mut num_str = String::new();
                let mut is_real = false;
                while pos < len && (chars[pos].is_ascii_digit() || chars[pos] == '.') {
                    if chars[pos] == '.' {
                        if is_real {
                            break; // second dot — let parser fail
                        }
                        is_real = true;
                        if pos + 1 >= len || !chars[pos + 1].is_ascii_digit() {
                            // dot not followed by digit — maybe it's a range or something, stop here
                            is_real = false;
                            break;
                        }
                    }
                    num_str.push(chars[pos]);
                    col += 1;
                    pos += 1;
                }
                if is_real {
                    let val: f64 = num_str.parse().unwrap_or(0.0);
                    tokens.push(TokenInfo::new(Token::RealLiteral(val), start_line, start_col));
                } else {
                    let val: i64 = num_str.parse().unwrap_or(0);
                    tokens.push(TokenInfo::new(Token::IntegerLiteral(val), start_line, start_col));
                }
            }
            _ => {
                return Err(LexError::UnexpectedChar(ch, line, col));
            }
        }
    }

    Ok(tokens)
}

fn match_keyword(s: &str) -> Token {
    match s {
        "PROGRAM" => Token::Program,
        "END_PROGRAM" => Token::EndProgram,
        "VAR" => Token::Var,
        "END_VAR" => Token::EndVar,
        "IF" => Token::If,
        "THEN" => Token::Then,
        "ELSE" => Token::Else,
        "END_IF" => Token::EndIf,
        "AND" => Token::And,
        "OR" => Token::Or,
        "NOT" => Token::Not,
        "INT" => Token::Int,
        "REAL" => Token::Real,
        "BOOL" => Token::Bool,
        "DINT" => Token::DInt,
        "LREAL" => Token::LReal,
        "BYTE" => Token::Byte,
        "WORD" => Token::Word,
        "DWORD" => Token::DWord,
        _ => Token::Identifier(s.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tokenize_simple_assignment() {
        let src = "x := 42;";
        let tokens = tokenize(src).unwrap();
        assert_eq!(tokens.len(), 4);
        assert_eq!(tokens[0].token, Token::Identifier("x".into()));
        assert_eq!(tokens[1].token, Token::Assign);
        assert_eq!(tokens[2].token, Token::IntegerLiteral(42));
        assert_eq!(tokens[3].token, Token::Semicolon);
    }

    #[test]
    fn test_tokenize_arithmetic() {
        let src = "a + b * c";
        let tokens = tokenize(src).unwrap();
        assert_eq!(tokens.len(), 5);
        assert_eq!(tokens[0].token, Token::Identifier("a".into()));
        assert_eq!(tokens[1].token, Token::Plus);
        assert_eq!(tokens[2].token, Token::Identifier("b".into()));
        assert_eq!(tokens[3].token, Token::Star);
        assert_eq!(tokens[4].token, Token::Identifier("c".into()));
    }

    #[test]
    fn test_tokenize_comparison() {
        let src = "x > 5";
        let tokens = tokenize(src).unwrap();
        assert_eq!(tokens.len(), 3);
        assert_eq!(tokens[0].token, Token::Identifier("x".into()));
        assert_eq!(tokens[1].token, Token::Greater);
        assert_eq!(tokens[2].token, Token::IntegerLiteral(5));
    }

    #[test]
    fn test_tokenize_keywords() {
        let src = "PROGRAM IF THEN ELSE END_IF END_PROGRAM VAR END_VAR AND OR NOT";
        let tokens = tokenize(src).unwrap();
        let expected = vec![
            Token::Program,
            Token::If,
            Token::Then,
            Token::Else,
            Token::EndIf,
            Token::EndProgram,
            Token::Var,
            Token::EndVar,
            Token::And,
            Token::Or,
            Token::Not,
        ];
        for (i, expected) in expected.iter().enumerate() {
            assert_eq!(tokens[i].token, *expected, "mismatch at index {i}");
        }
    }

    #[test]
    fn test_comment_stripping() {
        let src = "x := 1; (* comment *) y := 2;";
        let tokens = tokenize(src).unwrap();
        assert_eq!(tokens.len(), 8);
        assert_eq!(tokens[0].token, Token::Identifier("x".into()));
        assert_eq!(tokens[4].token, Token::Identifier("y".into()));
    }

    #[test]
    fn test_nested_comments() {
        let src = "x (* outer (* inner *) still comment *) := 3;";
        let tokens = tokenize(src).unwrap();
        assert_eq!(tokens.len(), 4);
        assert_eq!(tokens[0].token, Token::Identifier("x".into()));
        assert_eq!(tokens[1].token, Token::Assign);
        assert_eq!(tokens[2].token, Token::IntegerLiteral(3));
        assert_eq!(tokens[3].token, Token::Semicolon);
    }

    #[test]
    fn test_not_equal_operator() {
        let src = "a <> b";
        let tokens = tokenize(src).unwrap();
        assert_eq!(tokens.len(), 3);
        assert_eq!(tokens[1].token, Token::NotEqual);
    }

    #[test]
    fn test_less_eq_greater_eq() {
        let src = "a <= b >= c";
        let tokens = tokenize(src).unwrap();
        assert_eq!(tokens.len(), 5);
        assert_eq!(tokens[1].token, Token::LessEq);
        assert_eq!(tokens[3].token, Token::GreaterEq);
    }
}
