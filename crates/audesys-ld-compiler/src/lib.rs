//! AUDESYS IEC 61131-3 LD (Ladder Diagram) compiler.
//!
//! Compiles LD source text to IL text, which then feeds into the
//! `audesys-il-compiler` for full HAL IR compilation.
//!
//! # LD text format
//!
//! ```text
//! NETWORK
//!   NO X1       -- normally open contact (| |)
//!   NO X2       -- series contact
//!   OUT Y1      -- output coil ( )
//!
//! NETWORK
//!   NC X3       -- normally closed contact (|/|)
//!   OUT Y2
//! ```
//!
//! Supported elements:
//! - `NO var` — normally open contact
//! - `NC var` — normally closed contact
//! - `OUT var` — output coil
//! - `SET var` — set (latch) coil
//! - `RESET var` — reset (unlatch) coil
//!
//! # Mapping to IL
//!
//! | LD element     | First in network | Subsequent   |
//! |----------------|------------------|--------------|
//! | NO contact     | `LD var`         | `AND var`    |
//! | NC contact     | `LDN var`        | `ANDN var`   |
//! | OUT coil       | `ST var`         | —            |
//! | SET coil       | `S var`          | —            |
//! | RESET coil     | `R var`          | —            |
//!
//! # Full pipeline
//!
//! ```ignore
//! use audesys_ld_compiler::ld_compile;
//! use audesys_il_compiler::il_compile;
//!
//! let il_text = ld_compile("NETWORK\n  NO X1\n  NO X2\n  OUT Y1").unwrap();
//! let hal_prog = il_compile(&il_text).unwrap();
//! ```

mod lexer;
mod codegen;

/// Compile LD (Ladder Diagram) source text to IEC 61131-3 IL text.
///
/// Returns `Err(String)` if the source is malformed (empty after tokenization).
pub fn ld_compile(source: &str) -> Result<String, String> {
    let tokens = lexer::tokenize(source);
    if tokens.is_empty() {
        return Err("empty LD source".to_string());
    }
    let networks = codegen::parse_networks(&tokens);
    let il_text = codegen::generate_il(&networks);
    Ok(il_text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_network() {
        let src = "NETWORK\n  NO X1\n  NO X2\n  OUT Y1";
        let il = ld_compile(src).unwrap();
        assert_eq!(il, "LD X1\nAND X2\nST Y1");
    }

    #[test]
    fn test_nc_contact() {
        let src = "NETWORK\n  NO X1\n  NC X2\n  OUT Y1";
        let il = ld_compile(src).unwrap();
        assert_eq!(il, "LD X1\nANDN X2\nST Y1");
    }

    #[test]
    fn test_first_nc_contact() {
        let src = "NETWORK\n  NC X1\n  OUT Y1";
        let il = ld_compile(src).unwrap();
        assert_eq!(il, "LDN X1\nST Y1");
    }

    #[test]
    fn test_multiple_networks() {
        let src = "NETWORK\n  NO X1\n  OUT Y1\nNETWORK\n  NO X2\n  OUT Y2";
        let il = ld_compile(src).unwrap();
        assert_eq!(il, "LD X1\nST Y1\nLD X2\nST Y2");
    }

    #[test]
    fn test_empty_source_is_error() {
        let result = ld_compile("");
        assert!(result.is_err());
    }

    #[test]
    fn test_set_reset_coils() {
        let src = "NETWORK\n  NO X1\n  SET Y1\n  NETWORK\n  NO X2\n  RESET Y1";
        let il = ld_compile(src).unwrap();
        assert_eq!(il, "LD X1\nS Y1\nLD X2\nR Y1");
    }

    #[test]
    fn test_single_contact_single_coil() {
        let src = "NETWORK\n  NO X1\n  OUT Y1";
        let il = ld_compile(src).unwrap();
        assert_eq!(il, "LD X1\nST Y1");
    }

    #[test]
    fn test_pipeline_ld_to_il_to_hal() {
        let ld_src = "NETWORK\n  NO X1\n  NO X2\n  OUT Y1";
        let il_text = ld_compile(ld_src).unwrap();
        assert_eq!(il_text, "LD X1\nAND X2\nST Y1");

        // Feed into IL compiler
        let hal_prog = audesys_il_compiler::il_compile(&il_text).unwrap();
        assert!(hal_prog.is_well_formed());
        assert!(!hal_prog.instructions.is_empty());
    }

    #[test]
    fn test_pipeline_nc_contact() {
        let ld_src = "NETWORK\n  NC X1\n  OUT Y1";
        let il_text = ld_compile(ld_src).unwrap();
        let hal_prog = audesys_il_compiler::il_compile(&il_text).unwrap();
        assert!(hal_prog.is_well_formed());
    }

    #[test]
    fn test_pipeline_multiple_networks() {
        let ld_src = "NETWORK\n  NO X1\n  OUT Y1\nNETWORK\n  NO X2\n  OUT Y2";
        let il_text = ld_compile(ld_src).unwrap();
        let hal_prog = audesys_il_compiler::il_compile(&il_text).unwrap();
        assert!(hal_prog.is_well_formed());
    }

    #[test]
    fn test_pipeline_execute() {
        let ld_src = "NETWORK\n  NO X1\n  NO X2\n  OUT Y1";
        let il_text = ld_compile(ld_src).unwrap();
        let hal_prog = audesys_il_compiler::il_compile(&il_text).unwrap();
        let mut executor = audesys_hal_ir::Executor::new(hal_prog);
        let steps = executor.run_to_halt();
        assert!(steps > 0, "pipeline should execute");
    }
}
