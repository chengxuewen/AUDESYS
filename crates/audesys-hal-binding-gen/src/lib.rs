//! AUDESYS HAL Binding Generator — IEC 61131-3 Structured Text to HAL IR compiler.
//!
//! Provides `compile(source: &str) -> Result<HalProgram, CompileError>`.

mod lexer;
mod parser;
mod codegen;

use audesys_hal_ir::program::HalProgram;
use thiserror::Error;

/// Top-level compiler error.
#[derive(Debug, Error)]
pub enum CompileError {
    /// Lexer error (unexpected character, unterminated string).
    #[error("lexer error: {0}")]
    Lex(#[from] lexer::LexError),
    /// Parser error (unexpected token, redeclared variable, etc.).
    #[error("parse error: {0}")]
    Parse(#[from] parser::ParseError),
    /// Code generation error (undefined variable, too many variables).
    #[error("codegen error: {0}")]
    Codegen(#[from] codegen::CodegenError),
}

/// Compile an IEC 61131-3 Structured Text source string into a HalProgram.
pub fn compile(source: &str) -> Result<HalProgram, CompileError> {
    let tokens = lexer::tokenize(source)?;
    let ast = parser::parse_program(tokens)?;
    let program = codegen::compile_ast(&ast)?;
    Ok(program)
}

#[cfg(test)]
mod tests {
    use super::*;
    use audesys_hal_ir::instruction::Opcode;

    fn check_program(src: &str) -> HalProgram {
        match compile(src) {
            Ok(p) => p,
            Err(e) => panic!("compilation failed: {e}"),
        }
    }

    #[test]
    fn test_simple_assignment() {
        let src = "PROGRAM test VAR x : INT; END_VAR; x := 42; END_PROGRAM";
        let p = check_program(src);
        assert!(p.is_well_formed());
        let loads: Vec<_> = p.instructions.iter().filter(|i| i.opcode == Opcode::Load).collect();
        assert!(!loads.is_empty());
    }

    #[test]
    fn test_arithmetic_add() {
        let src = "PROGRAM test VAR a : INT; b : INT; c : INT; END_VAR; c := a + b; END_PROGRAM";
        let p = check_program(src);
        assert!(p.is_well_formed());
        assert!(p.instructions.iter().any(|i| i.opcode == Opcode::Add));
    }

    #[test]
    fn test_if_else() {
        let src = "PROGRAM test VAR x : INT; y : INT; END_VAR; IF x > 0 THEN y := 1; ELSE y := 0; END_IF; END_PROGRAM";
        let p = check_program(src);
        assert!(p.is_well_formed());
        assert!(p.instructions.iter().any(|i| i.opcode == Opcode::JumpIf));
    }

    #[test]
    fn test_comparison_expr() {
        let src = "PROGRAM test VAR a : INT; b : INT; x : BOOL; END_VAR; x := a > b; END_PROGRAM";
        let p = check_program(src);
        assert!(p.is_well_formed());
        assert!(p.instructions.iter().any(|i| i.opcode == Opcode::Gt));
    }

    #[test]
    fn test_precedence_mult_before_add() {
        let src = "PROGRAM test VAR a : INT; b : INT; c : INT; d : INT; END_VAR; d := a + b * c; END_PROGRAM";
        let p = check_program(src);
        // b*c should be computed first (Mul), then a+result (Add)
        let ops: Vec<_> = p.instructions.iter().filter(|i| matches!(i.opcode, Opcode::Mul | Opcode::Add)).map(|i| i.opcode).collect();
        assert!(ops.windows(2).any(|w| w[0] == Opcode::Mul && w[1] == Opcode::Add),
            "Mul should appear before Add for a + b * c");
    }

    #[test]
    fn test_boolean_and_condition() {
        let src = "PROGRAM test VAR x : INT; y : INT; z : INT; END_VAR; IF x > 0 AND y < 10 THEN z := 1; END_IF; END_PROGRAM";
        let p = check_program(src);
        assert!(p.is_well_formed());
        assert!(p.instructions.iter().any(|i| i.opcode == Opcode::JumpIf));
    }

    #[test]
    fn test_redeclared_variable() {
        let src = "PROGRAM test VAR x : INT; x : REAL; END_VAR; END_PROGRAM";
        assert!(compile(src).is_err());
    }

    #[test]
    fn test_undefined_variable() {
        let src = "PROGRAM test VAR x : INT; END_VAR; y := 42; END_PROGRAM";
        assert!(compile(src).is_err());
    }

    #[test]
    fn test_empty_program() {
        let src = "PROGRAM empty END_PROGRAM";
        let p = check_program(src);
        assert!(p.is_well_formed());
        assert_eq!(p.instructions.len(), 1);
        assert_eq!(p.instructions[0].opcode, Opcode::Halt);
    }

    #[test]
    fn test_boolean_not_condition() {
        let src = "PROGRAM test VAR a : INT; b : INT; r : BOOL; END_VAR; r := NOT a = b; END_PROGRAM";
        let p = check_program(src);
        assert!(p.is_well_formed());
    }
}
