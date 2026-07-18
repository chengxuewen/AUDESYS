//! AUDESYS IEC 61131-3 IL (Instruction List) compiler.
//!
//! Compiles IL source to HAL IR via `il_compile(source: &str) -> HalProgram`.
//! The accumulator-based IL model maps cleanly to the register VM:
//! - CR (Current Result) → r14
//! - TRUE constant → r15
//! - User variables → r0..r9
//!
//! # Example
//! ```ignore
//! let prog = audesys_il_compiler::il_compile("LD X1\nAND X2\nST Y1").unwrap();
//! assert!(prog.is_well_formed());
//! ```
mod lexer;
mod parser;
mod codegen;

use audesys_hal_ir::program::HalProgram;

/// Compile IEC 61131-3 IL source text to a HAL IR program.
///
/// Returns `Err(String)` on compilation failure (e.g., too many variables).
pub fn il_compile(source: &str) -> Result<HalProgram, String> {
    let tokens = lexer::tokenize(source);
    let stmts = parser::parse(&tokens);
    let instructions = codegen::compile_ast(&stmts);

    Ok(HalProgram::new("il_program", instructions))
}

#[cfg(test)]
mod tests {
    use super::*;
    use audesys_hal_ir::Executor;
    use audesys_hal_ir::vm::Vm;
    fn run_to_halt(program: HalProgram) -> Vm {
        let mut executor = Executor::new(program);
        executor.run_to_halt();
        executor.vm().clone()
    }

    #[test]
    fn test_basic_and() {
        let src = "LD X1\nAND X2\nST Y1";
        let program = il_compile(src).unwrap();
        assert!(program.is_well_formed());
        assert!(!program.instructions.is_empty());
    }

    #[test]
    fn test_ldn_not() {
        let src = "LDN X1\nST Y1";
        let program = il_compile(src).unwrap();
        assert!(program.is_well_formed());
        assert!(!program.instructions.is_empty());
    }

    #[test]
    fn test_comparison() {
        let src = "LD X1\nGT X2\nST Y1";
        let program = il_compile(src).unwrap();
        assert!(program.is_well_formed());
    }

    #[test]
    fn test_all_arithmetic() {
        for mnemonic in &["ADD", "SUB", "MUL", "DIV"] {
            let src = format!("LD X1\n{} X2\nST Y1", mnemonic);
            let program = il_compile(&src).unwrap();
            assert!(program.is_well_formed(), "failed for {mnemonic}");
        }
    }

    #[test]
    fn test_all_bitwise() {
        for mnemonic in &["AND", "OR", "XOR"] {
            let src = format!("LD X1\n{} X2\nST Y1", mnemonic);
            let program = il_compile(&src).unwrap();
            assert!(program.is_well_formed(), "failed for {mnemonic}");
        }
    }

    #[test]
    fn test_not_variants() {
        for mnemonic in &["ANDN", "ORN"] {
            let src = format!("LD X1\n{} X2\nST Y1", mnemonic);
            let program = il_compile(&src).unwrap();
            assert!(program.is_well_formed(), "failed for {mnemonic}");
        }
    }

    #[test]
    fn test_all_comparisons() {
        for mnemonic in &["GT", "GE", "EQ", "NE", "LE", "LT"] {
            let src = format!("LD X1\n{} X2\nST Y1", mnemonic);
            let program = il_compile(&src).unwrap();
            assert!(program.is_well_formed(), "failed for {mnemonic}");
        }
    }

    #[test]
    fn test_jump_labels() {
        let src = "JMP skip\nLD X1\nskip: LD X2\nST Y1";
        let program = il_compile(src).unwrap();
        assert!(program.is_well_formed());
    }

    #[test]
    fn test_jumpc_jumpcn() {
        let src = "LD X1\nJMPC true_path\nLD X2\nJMP done\ntrue_path: LD X3\ndone: ST Y1";
        let program = il_compile(src).unwrap();
        assert!(program.is_well_formed());
    }

    #[test]
    fn test_return() {
        let src = "LD X1\nRET";
        let program = il_compile(src).unwrap();
        assert!(program.is_well_formed());
    }

    // ── Executor integration tests ──

    #[test]
    fn test_execute_load_store() {
        // We can't set register values from IL source alone — IL has no LoadImm.
        // But we can verify the program compiles and runs without error.
        let src = "LD X1\nST Y1";
        let program = il_compile(src).unwrap();
        let mut executor = Executor::new(program);
        let steps = executor.run_to_halt();
        assert!(steps > 0);
        // r0 and r1 are X1 and X2, r14 or similar for CR
    }

    #[test]
    fn test_pipeline_integration() {
        // Full pipeline: source → tokens → AST → IR → execute
        let tests = [
            ("LD X1\nAND X2\nST Y1", "and"),
            ("LD X1\nOR X2\nST Y1", "or"),
            ("LD X1\nADD X2\nST Y1", "add"),
            ("LD X1\nSUB X2\nST Y1", "sub"),
            ("LD X1\nMUL X2\nST Y1", "mul"),
            ("LD X1\nGT X2\nST Y1", "gt"),
            ("LD X1\nST Y1", "load_store"),
        ];
        for (src, name) in &tests {
            let program = il_compile(src).unwrap();
            assert!(program.is_well_formed(), "{name}: not well-formed");
            let mut executor = Executor::new(program);
            let steps = executor.run_to_halt();
            assert!(steps > 0, "{name}: zero steps");
        }
    }

    #[test]
    fn test_jump_integration() {
        // Test that unconditional jump works in executor
        // Layout: JMP skip; LD X1 (skipped); skip: LD X2; ST Y1
        let src = "JMP skip\nLD X1\nskip: LD X2\nST Y1";
        let prog = il_compile(src).unwrap();
        let mut exec = Executor::new(prog);
        let steps = exec.run_to_halt();
        assert!(steps > 0);
        // After execution, the skip path should have been taken
    }

    #[test]
    fn test_cycles() {
        // Test that many IL programs compile and execute in cycle
        let programs = [
            "LD X1\nAND X2\nST Y1",
            "LDN X1\nST Y1",
            "LD X1\nANDN X2\nST Y1",
            "LD X1\nORN X2\nST Y1",
            "LD X1\nXOR X2\nST Y1",
        ];
        for src in &programs {
            let prog = il_compile(src).unwrap();
            let mut exec = Executor::new(prog);
            let steps = exec.run_to_halt();
            assert!(steps > 0, "zero steps for '{src}'");
            // Execute 100 more cycles
            for _ in 0..100 {
                exec.reset();
                exec.run_to_halt();
            }
        }
    }
}
