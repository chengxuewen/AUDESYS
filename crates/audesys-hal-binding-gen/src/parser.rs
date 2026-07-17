//! ST parser — recursive descent parser for IEC 61131-3 Structured Text subset.
//! Phase 1: simple programs with variables, assignments, expressions, if/else.

use crate::lexer::{Token, TokenInfo};

/// Types supported in variable declarations.
#[derive(Debug, Clone, PartialEq)]
pub enum VarType {
    Int,  // → S32
    Real, // → F32
    Bool,
    DInt,  // → S64
    LReal, // → F64
    Byte,  // → U8
    Word,  // → U16
    DWord, // → U32
}

/// Binary operator.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BinOp {
    Add,
    Sub,
    Mul,
    Div,
    Eq,
    Neq,
    Gt,
    Lt,
    Gte,
    Lte,
    And,
    Or,
    Mod,
    Xor,
}

/// Unary operator.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum UnaryOp {
    Neg,
    Not,
}

/// AST expression.
#[derive(Debug, Clone, PartialEq)]
pub enum Expr {
    /// Integer literal
    IntLiteral(i64),
    /// Real (floating) literal
    RealLiteral(f64),
    /// Bool literal
    BoolLiteral(bool),
    /// Variable reference
    Variable(String),
    /// Binary operation: left op right
    Binary(Box<Expr>, BinOp, Box<Expr>),
    /// Unary operation: op expr
    Unary(UnaryOp, Box<Expr>),
}

impl Expr {
    pub fn binary(left: Expr, op: BinOp, right: Expr) -> Self {
        Expr::Binary(Box::new(left), op, Box::new(right))
    }

    pub fn unary(op: UnaryOp, expr: Expr) -> Self {
        Expr::Unary(op, Box::new(expr))
    }
}

/// A statement in the program body.
#[derive(Debug, Clone, PartialEq)]
pub enum Statement {
    /// Assignment: variable := expression
    Assign { name: String, value: Expr },
    /// If-then-else: condition and two blocks
    If { condition: Expr, then_body: Vec<Statement>, else_body: Vec<Statement> },
    /// While loop: condition and body
    While { condition: Expr, body: Vec<Statement> },
    /// For loop: variable, start, end, optional step, body
    For { variable: String, start: Expr, end: Expr, step: Option<Expr>, body: Vec<Statement> },
    Case { variable: String, cases: Vec<(Vec<i64>, Vec<Statement>)>, else_body: Vec<Statement> },
}

/// A variable declaration.
#[derive(Debug, Clone, PartialEq)]
pub struct Variable {
    pub name: String,
    pub var_type: VarType,
}

/// Complete parsed program AST.
#[derive(Debug, Clone, PartialEq)]
pub struct Program {
    pub name: String,
    pub variables: Vec<Variable>,
    pub body: Vec<Statement>,
}

/// Parser error.
#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum ParseError {
    #[error("unexpected token {0:?} at line {1}, col {2}")]
    UnexpectedToken(Token, usize, usize),
    #[error("unexpected end of input")]
    UnexpectedEof,
    #[error("expected token {0:?} at line {1}, col {2}")]
    ExpectedToken(Token, usize, usize),
    #[error("variable '{0}' redeclared at line {1}")]
    RedefinedVariable(String, usize),
}

/// Parser state: token stream with position.
struct Parser {
    tokens: Vec<TokenInfo>,
    pos: usize,
}

impl Parser {
    fn new(tokens: Vec<TokenInfo>) -> Self {
        Parser { tokens, pos: 0 }
    }

    fn current(&self) -> Option<&TokenInfo> {
        self.tokens.get(self.pos)
    }

    fn advance(&mut self) -> Option<&TokenInfo> {
        let tok = self.tokens.get(self.pos);
        self.pos += 1;
        tok
    }

    fn peek_token(&self) -> Option<&Token> {
        self.current().map(|ti| &ti.token)
    }

    fn expect(&mut self, expected: Token) -> Result<&TokenInfo, ParseError> {
        match self.advance() {
            Some(ti) if ti.token == expected => Ok(ti),
            Some(ti) => {
                Err(ParseError::UnexpectedToken(ti.token.clone(), ti.span.line, ti.span.col))
            }
            None => Err(ParseError::UnexpectedEof),
        }
    }

    fn expect_ident(&mut self) -> Result<(String, usize, usize), ParseError> {
        match self.advance() {
            Some(ti) => match &ti.token {
                Token::Identifier(name) => Ok((name.clone(), ti.span.line, ti.span.col)),
                _ => Err(ParseError::UnexpectedToken(ti.token.clone(), ti.span.line, ti.span.col)),
            },
            None => Err(ParseError::UnexpectedEof),
        }
    }
}

/// Parse a complete ST program.
pub fn parse_program(tokens: Vec<TokenInfo>) -> Result<Program, ParseError> {
    let mut parser = Parser::new(tokens);
    parse_program_inner(&mut parser)
}

fn parse_program_inner(p: &mut Parser) -> Result<Program, ParseError> {
    p.expect(Token::Program)?;
    let (name, _, _) = p.expect_ident()?;

    // Variable declarations (optional)
    let variables =
        if p.peek_token() == Some(&Token::Var) { parse_var_block(p)? } else { Vec::new() };

    // Check for redeclared variables
    let mut seen = std::collections::HashMap::new();
    for var in &variables {
        if let Some(&(line, _)) = seen.get(&var.name) {
            return Err(ParseError::RedefinedVariable(var.name.clone(), line));
        }
        seen.insert(var.name.clone(), (0, 0)); // actual line info not critical here
    }

    // Statement body
    let body = parse_statements_until(p, &Token::EndProgram)?;

    p.expect(Token::EndProgram)?;

    Ok(Program { name, variables, body })
}

fn parse_var_block(p: &mut Parser) -> Result<Vec<Variable>, ParseError> {
    p.expect(Token::Var)?;
    let mut vars = Vec::new();
    while p.peek_token() != Some(&Token::EndVar) {
        let (name, line, _col) = p.expect_ident()?;
        p.expect(Token::Colon)?;
        let var_type = parse_var_type(p)?;
        p.expect(Token::Semicolon)?;

        // Check redeclaration within this block
        if vars.iter().any(|v: &Variable| v.name == name) {
            return Err(ParseError::RedefinedVariable(name, line));
        }
        vars.push(Variable { name, var_type });
    }
    p.expect(Token::EndVar)?;
    p.expect(Token::Semicolon)?;
    Ok(vars)
}

fn parse_var_type(p: &mut Parser) -> Result<VarType, ParseError> {
    match p.advance() {
        Some(ti) => match &ti.token {
            Token::Int => Ok(VarType::Int),
            Token::Real => Ok(VarType::Real),
            Token::Bool => Ok(VarType::Bool),
            Token::DInt => Ok(VarType::DInt),
            Token::LReal => Ok(VarType::LReal),
            Token::Byte => Ok(VarType::Byte),
            Token::Word => Ok(VarType::Word),
            Token::DWord => Ok(VarType::DWord),
            _ => Err(ParseError::UnexpectedToken(ti.token.clone(), ti.span.line, ti.span.col)),
        },
        None => Err(ParseError::UnexpectedEof),
    }
}

/// Parse statements until we see a stop token (EndProgram, Else, EndIf).
fn parse_statements_until(p: &mut Parser, stop: &Token) -> Result<Vec<Statement>, ParseError> {
    let mut stmts = Vec::new();
    while p.peek_token() != Some(stop) {
        stmts.push(parse_statement(p)?);
    }
    Ok(stmts)
}

fn parse_statement(p: &mut Parser) -> Result<Statement, ParseError> {
    match p.peek_token() {
        Some(Token::If) => parse_if(p),
        Some(Token::While) => parse_while(p),
        Some(Token::For) => parse_for(p),
        Some(Token::Case) => parse_case(p),
        _ => parse_assignment(p),
    }
}

fn parse_assignment(p: &mut Parser) -> Result<Statement, ParseError> {
    let (name, _line, _col) = p.expect_ident()?;
    p.expect(Token::Assign)?;
    let value = parse_expression(p)?;
    p.expect(Token::Semicolon)?;
    Ok(Statement::Assign { name, value })
}

fn parse_if(p: &mut Parser) -> Result<Statement, ParseError> {
    p.expect(Token::If)?;
    let condition = parse_expression(p)?;
    p.expect(Token::Then)?;

    // Then body: stop at Else or EndIf
    let mut then_body = Vec::new();
    while p.peek_token() != Some(&Token::Else) && p.peek_token() != Some(&Token::EndIf) {
        then_body.push(parse_statement(p)?);
    }

    let else_body = if p.peek_token() == Some(&Token::Else) {
        p.expect(Token::Else)?;
        let mut body = Vec::new();
        while p.peek_token() != Some(&Token::EndIf) {
            body.push(parse_statement(p)?);
        }
        body
    } else {
        Vec::new()
    };

    p.expect(Token::EndIf)?;
    p.expect(Token::Semicolon)?;

    Ok(Statement::If { condition, then_body, else_body })
}

fn parse_while(p: &mut Parser) -> Result<Statement, ParseError> {
    p.expect(Token::While)?;
    let condition = parse_expression(p)?;
    p.expect(Token::Do)?;

    let mut body = Vec::new();
    while p.peek_token() != Some(&Token::EndWhile) {
        body.push(parse_statement(p)?);
    }

    p.expect(Token::EndWhile)?;
    p.expect(Token::Semicolon)?;

    Ok(Statement::While { condition, body })
}

fn parse_for(p: &mut Parser) -> Result<Statement, ParseError> {
    // FOR variable := start TO end BY step DO body END_FOR;
    p.expect(Token::For)?;
    let (variable, _line, _col) = p.expect_ident()?;
    p.expect(Token::Assign)?;
    let start = parse_expression(p)?;
    p.expect(Token::To)?;
    let end = parse_expression(p)?;
    // ponytail: BY is optional, defaults to 1; negative step deferred to Phase 2
    let step = if p.peek_token() == Some(&Token::By) {
        p.expect(Token::By)?;
        Some(parse_expression(p)?)
    } else {
        None
    };
    p.expect(Token::Do)?;

    let mut body = Vec::new();
    while p.peek_token() != Some(&Token::EndFor) {
        body.push(parse_statement(p)?);
    }

    p.expect(Token::EndFor)?;
    p.expect(Token::Semicolon)?;

    Ok(Statement::For { variable, start, end, step, body })
}

fn parse_case(p: &mut Parser) -> Result<Statement, ParseError> {
    // CASE variable OF
    //   value, value, ... : body;
    //   ...
    // [ELSE else_body;]
    // END_CASE;
    p.expect(Token::Case)?;
    let (variable, _line, _col) = p.expect_ident()?;
    p.expect(Token::Of)?;

    let mut cases: Vec<(Vec<i64>, Vec<Statement>)> = Vec::new();
    loop {
        let next = p.peek_token();
        if next == Some(&Token::EndCase) || next == Some(&Token::Else) {
            break;
        }
        let values = parse_case_values(p)?;
        let mut body = Vec::new();
        while {
            let tok = p.peek_token();
            tok != Some(&Token::Else)
                && tok != Some(&Token::EndCase)
                && !matches!(tok, Some(Token::IntegerLiteral(_)))
        } {
            body.push(parse_statement(p)?);
        }
        cases.push((values, body));
    }

    let else_body = if p.peek_token() == Some(&Token::Else) {
        p.expect(Token::Else)?;
        parse_statements_until(p, &Token::EndCase)?
    } else {
        Vec::new()
    };

    p.expect(Token::EndCase)?;
    p.expect(Token::Semicolon)?;

    Ok(Statement::Case { variable, cases, else_body })
}

fn parse_case_values(p: &mut Parser) -> Result<Vec<i64>, ParseError> {
    let mut values = Vec::new();
    loop {
        match p.advance() {
            Some(TokenInfo { token: Token::IntegerLiteral(n), .. }) => values.push(*n),
            Some(ti) => {
                return Err(ParseError::UnexpectedToken(
                    ti.token.clone(), ti.span.line, ti.span.col
                ));
            }
            None => return Err(ParseError::UnexpectedEof),
        }
        match p.peek_token() {
            Some(Token::Colon) => {
                p.advance();
                return Ok(values);
            }
            Some(Token::Comma) => {
                p.advance();
                // continue to next value
            }
            _ => {
                return Err(ParseError::ExpectedToken(
                    Token::Colon,
                    p.current().map(|t| t.span.line).unwrap_or(0),
                    p.current().map(|t| t.span.col).unwrap_or(0),
                ));
            }
        }
    }
}

// ── Expression parsing with precedence climbing ──

/// Precedence levels (higher = binds tighter).
fn precedence(op: &BinOp) -> u8 {
    match op {
        BinOp::Or | BinOp::Xor => 1,
        BinOp::And => 2,
        BinOp::Eq | BinOp::Neq | BinOp::Gt | BinOp::Lt | BinOp::Gte | BinOp::Lte => 3,
        BinOp::Add | BinOp::Sub => 4,
        BinOp::Mul | BinOp::Div | BinOp::Mod => 5,
    }
}

fn token_to_binop(token: &Token) -> Option<BinOp> {
    match token {
        Token::Plus => Some(BinOp::Add),
        Token::Minus => Some(BinOp::Sub),
        Token::Star => Some(BinOp::Mul),
        Token::Slash => Some(BinOp::Div),
        Token::Equal => Some(BinOp::Eq),
        Token::NotEqual => Some(BinOp::Neq),
        Token::Greater => Some(BinOp::Gt),
        Token::Less => Some(BinOp::Lt),
        Token::GreaterEq => Some(BinOp::Gte),
        Token::LessEq => Some(BinOp::Lte),
        Token::And => Some(BinOp::And),
        Token::Or => Some(BinOp::Or),
        Token::Mod => Some(BinOp::Mod),
        Token::Xor => Some(BinOp::Xor),
        _ => None,
    }
}

fn parse_expression(p: &mut Parser) -> Result<Expr, ParseError> {
    parse_expr_prec(p, 0)
}

fn parse_expr_prec(p: &mut Parser, min_prec: u8) -> Result<Expr, ParseError> {
    let mut left = parse_unary(p)?;

    loop {
        let Some(tok) = p.peek_token() else { break };
        let Some(op) = token_to_binop(tok) else { break };
        if precedence(&op) >= min_prec {
            p.advance();
            let next_prec = precedence(&op) + 1;
            let right = parse_expr_prec(p, next_prec)?;
            left = Expr::binary(left, op, right);
        } else {
            break;
        }
    }


    Ok(left)
}

fn parse_unary(p: &mut Parser) -> Result<Expr, ParseError> {
    match p.peek_token() {
        Some(Token::Minus) => {
            p.advance();
            let expr = parse_unary(p)?;
            Ok(Expr::unary(UnaryOp::Neg, expr))
        }
        Some(Token::Not) => {
            p.advance();
            let expr = parse_unary(p)?;
            Ok(Expr::unary(UnaryOp::Not, expr))
        }
        _ => parse_primary(p),
    }
}

fn parse_primary(p: &mut Parser) -> Result<Expr, ParseError> {
    match p.advance() {
        Some(ti) => match &ti.token {
            Token::IntegerLiteral(n) => Ok(Expr::IntLiteral(*n)),
            Token::RealLiteral(n) => Ok(Expr::RealLiteral(*n)),
            Token::Identifier(name) => {
                // Check for boolean literals
                match name.as_str() {
                    "TRUE" => Ok(Expr::BoolLiteral(true)),
                    "FALSE" => Ok(Expr::BoolLiteral(false)),
                    _ => Ok(Expr::Variable(name.clone())),
                }
            }
            Token::LParen => {
                let expr = parse_expression(p)?;
                p.expect(Token::RParen)?;
                Ok(expr)
            }
            _ => Err(ParseError::UnexpectedToken(ti.token.clone(), ti.span.line, ti.span.col)),
        },
        None => Err(ParseError::UnexpectedEof),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lexer::{LexError, tokenize};

    fn parse(src: &str) -> Result<Program, ParseError> {
        let tokens = tokenize(src).map_err(|e| match e {
            LexError::UnexpectedChar(_, _, _) => ParseError::UnexpectedEof,
            LexError::UnterminatedString(_, _) => ParseError::UnexpectedEof,
        })?;
        parse_program(tokens)
    }

    #[test]
    fn test_empty_program() {
        let p = parse("PROGRAM empty END_PROGRAM").unwrap();
        assert_eq!(p.name, "empty");
        assert!(p.variables.is_empty());
        assert!(p.body.is_empty());
    }

    #[test]
    fn test_var_declarations() {
        let src = "PROGRAM test VAR x : INT; y : REAL; END_VAR; END_PROGRAM";
        let p = parse(src).unwrap();
        assert_eq!(p.variables.len(), 2);
        assert_eq!(p.variables[0].name, "x");
        assert_eq!(p.variables[0].var_type, VarType::Int);
        assert_eq!(p.variables[1].name, "y");
        assert_eq!(p.variables[1].var_type, VarType::Real);
    }

    #[test]
    fn test_assignment() {
        let src = "PROGRAM test VAR x : INT; END_VAR; x := 42; END_PROGRAM";
        let p = parse(src).unwrap();
        assert_eq!(p.body.len(), 1);
        match &p.body[0] {
            Statement::Assign { name, value } => {
                assert_eq!(name, "x");
                assert_eq!(*value, Expr::IntLiteral(42));
            }
            _ => panic!("expected assignment"),
        }
    }

    #[test]
    fn test_arithmetic_precedence() {
        let src =
            "PROGRAM test VAR a : INT; b : INT; c : INT; END_VAR; a := b + c * 2; END_PROGRAM";
        let p = parse(src).unwrap();
        match &p.body[0] {
            Statement::Assign { value, .. } => {
                // Should be: Variable("b") + (Variable("c") * IntLiteral(2))
                assert!(matches!(value, Expr::Binary(..)));
                if let Expr::Binary(left, BinOp::Add, right) = value {
                    assert_eq!(**left, Expr::Variable("b".into()));
                    assert!(matches!(**right, Expr::Binary(_, BinOp::Mul, _)));
                } else {
                    panic!("expected Add at top level");
                }
            }
            _ => panic!("expected assignment"),
        }
    }

    #[test]
    fn test_if_else() {
        let src = "PROGRAM test VAR x : INT; y : INT; END_VAR; IF x > 0 THEN y := 1; ELSE y := 0; END_IF; END_PROGRAM";
        let p = parse(src).unwrap();
        assert_eq!(p.body.len(), 1);
        match &p.body[0] {
            Statement::If { condition, then_body, else_body } => {
                assert!(matches!(condition, Expr::Binary(_, BinOp::Gt, _)));
                assert_eq!(then_body.len(), 1);
                assert_eq!(else_body.len(), 1);
            }
            _ => panic!("expected if statement"),
        }
    }

    #[test]
    fn test_boolean_condition() {
        let src = "PROGRAM test VAR x : INT; y : INT; END_VAR; IF x > 0 AND y < 10 THEN x := 1; END_IF; END_PROGRAM";
        let p = parse(src).unwrap();
        match &p.body[0] {
            Statement::If { condition, then_body, else_body } => {
                assert!(matches!(condition, Expr::Binary(_, BinOp::And, _)));
                assert_eq!(then_body.len(), 1);
                assert!(else_body.is_empty());
            }
            _ => panic!("expected if statement"),
        }
    }

    #[test]
    fn test_redeclared_variable_error() {
        let src = "PROGRAM test VAR x : INT; x : REAL; END_VAR; END_PROGRAM";
        assert!(parse(src).is_err());
    }

    #[test]
    fn test_not_expression() {
        // NOT binds tighter than =; use parens to flip precedence
        let src = "PROGRAM test VAR z : INT; END_VAR; x := NOT (z = 5); END_PROGRAM";
        let p = parse(src).unwrap();
        match &p.body[0] {
            Statement::Assign { value, .. } => {
                assert!(matches!(value, Expr::Unary(UnaryOp::Not, _)));
            }
            _ => panic!("expected assignment"),
        }
    }
}
