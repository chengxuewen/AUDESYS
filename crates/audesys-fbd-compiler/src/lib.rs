//! AUDESYS IEC 61131-3 FBD (Function Block Diagram) compiler.
//!
//! Compiles CFC (Continuous Function Chart) text format to IL text,
//! which then feeds into the `audesys-il-compiler` for full HAL IR compilation.
//!
//! # FBD text format (simplified CFC)
//!
//! ```text
//! BLOCK ton1 TON
//!
//! ton1.IN := x
//! ton1.PT := 500
//!
//! BLOCK cnt1 CTU
//!
//! cnt1.CU := ton1.Q
//! cnt1.PV := 10
//!
//! result := cnt1.Q
//! ```
//!
//! Supported function blocks: TON, TOF, TP, CTU, CTD, CTUD, SR, RS, R_TRIG, F_TRIG
//!
//! # Mapping to IL
//!
//! Each block expands to LD/ST for its inputs followed by a CAL instruction.
//! Block-to-block connections emit LD/ST pairs for the wire.
//! Outputs emit LD/ST from block.Q to the target variable.

use std::collections::BTreeMap;

// ── Types ──

/// Kinds of IEC 61131-3 standard function blocks.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum FbKind {
    Ton,
    Tof,
    Tp,
    Ctu,
    Ctd,
    Ctud,
    Sr,
    Rs,
    RTrig,
    FTrig,
}

impl FbKind {
    fn from_str(s: &str) -> Option<FbKind> {
        match s {
            "TON" => Some(FbKind::Ton),
            "TOF" => Some(FbKind::Tof),
            "TP" => Some(FbKind::Tp),
            "CTU" => Some(FbKind::Ctu),
            "CTD" => Some(FbKind::Ctd),
            "CTUD" => Some(FbKind::Ctud),
            "SR" => Some(FbKind::Sr),
            "RS" => Some(FbKind::Rs),
            "R_TRIG" => Some(FbKind::RTrig),
            "F_TRIG" => Some(FbKind::FTrig),
            _ => None,
        }
    }

    fn il_name(&self) -> &'static str {
        match self {
            FbKind::Ton => "TON",
            FbKind::Tof => "TOF",
            FbKind::Tp => "TP",
            FbKind::Ctu => "CTU",
            FbKind::Ctd => "CTD",
            FbKind::Ctud => "CTUD",
            FbKind::Sr => "SR",
            FbKind::Rs => "RS",
            FbKind::RTrig => "R_TRIG",
            FbKind::FTrig => "F_TRIG",
        }
    }
}

/// A parsed function block instance.
#[derive(Debug, Clone)]
struct FbBlock {
    name: String,
    kind: FbKind,
    /// Input pin wiring: pin_name → source expression (e.g. "x" or "ton1.Q")
    inputs: BTreeMap<String, String>,
    /// Output connections: source block name (to emit LD block.Q; ST target)
    outputs: BTreeMap<String, String>,
}

// ── Parser ──

/// Tokenize source into non-empty, non-comment lines.
fn tokenize(source: &str) -> Vec<String> {
    source
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !l.starts_with(';') && !l.starts_with("//"))
        .map(String::from)
        .collect()
}

/// Parse BLOCK and wiring statements into FbBlock instances.
fn parse_blocks(lines: &[String]) -> Result<Vec<FbBlock>, String> {
    let mut blocks: Vec<FbBlock> = Vec::new();
    let mut outputs: Vec<(String, String)> = Vec::new(); // (target, source_expr)

    for line in lines {
        let line = line.trim_end();
        if line.is_empty() {
            continue;
        }

        if let Some(rest) = line.strip_prefix("BLOCK ") {
            // BLOCK name KIND
            let parts: Vec<&str> = rest.split_whitespace().collect();
            if parts.len() < 2 {
                return Err(format!("malformed BLOCK statement: {line}"));
            }
            let name = parts[0].to_string();
            let kind_str = parts[1];
            let kind = FbKind::from_str(kind_str)
                .ok_or_else(|| format!("unknown block kind: {kind_str}"))?;

            // Check for duplicate block name
            if blocks.iter().any(|b| b.name == name) {
                return Err(format!("duplicate block name: {name}"));
            }

            blocks.push(FbBlock { name, kind, inputs: BTreeMap::new(), outputs: BTreeMap::new() });
        } else if let Some((lhs, rhs)) = parse_assignment(line) {
            let lhs = lhs.trim();
            let rhs = rhs.trim();

            if let Some((block_name, pin)) = split_dot(lhs) {
                // block.pin := expr  →  input wiring
                if let Some(blk) = blocks.iter_mut().find(|b| b.name == block_name) {
                    blk.inputs.insert(pin.to_string(), rhs.to_string());
                } else {
                    return Err(format!("unknown block in wiring: {block_name}"));
                }
            } else if let Some((src_block, src_pin)) = split_dot(rhs) {
                // output := block.pin  →  output wiring
                // Check if lhs is a plain variable (not block.pin)
                if blocks.iter().any(|b| b.name == lhs) {
                    return Err(format!(
                        "invalid wiring: lhs '{lhs}' is a block name, expected output variable"
                    ));
                }
                let _src_name = blocks
                    .iter()
                    .find(|b| b.name == src_block)
                    .map(|b| b.name.clone())
                    .ok_or_else(|| format!("unknown block in output wiring: {src_block}"))?;
                outputs.push((lhs.to_string(), format!("{src_block}.{src_pin}")));
            } else {
                // output := plain_var  →  plain output
                outputs.push((lhs.to_string(), rhs.to_string()));
            }
        } else {
            return Err(format!("unrecognized statement: {line}"));
        }
    }

    // Store output connections on the source block
    for (target, src_expr) in &outputs {
        if let Some((src_block, src_pin)) = split_dot(src_expr)
            && let Some(blk) = blocks.iter_mut().find(|b| b.name == src_block)
        {
            blk.outputs.insert(target.clone(), src_pin.to_string());
        }
    }

    if blocks.is_empty() {
        return Err("no function blocks found".to_string());
    }

    Ok(blocks)
}

/// Parse `A.B := C` or `A := B.C` into (A, B) or (lhs, rhs).
fn parse_assignment(line: &str) -> Option<(&str, &str)> {
    line.split_once(":=").map(|(l, r)| (l.trim(), r.trim()))
}

/// Split "a.b" into ("a", "b"), return None if no dot.
fn split_dot(s: &str) -> Option<(&str, &str)> {
    s.split_once('.')
}

// ── Codegen ──

/// Generate IL text from parsed FbBlock instances.
fn generate_il(blocks: &[FbBlock]) -> String {
    let mut il = String::new();

    for block in blocks {
        if !il.is_empty() {
            il.push('\n');
        }
        il.push_str(&format!("; BLOCK {} {}\n", block.name, block.kind.il_name()));

        // First, emit input wiring
        for (pin, val) in &block.inputs {
            il.push_str(&format!("LD {}\n", val));
            il.push_str(&format!("ST {}.{}\n", block.name, pin));
        }

        // CAL the block
        il.push_str(&format!("CAL {}\n", block.name));
    }

    // Then emit output wiring (in order added)
    for block in blocks {
        for (target, pin) in &block.outputs {
            il.push('\n');
            il.push_str(&format!("; Output {target}\n"));
            il.push_str(&format!("LD {}.{}\n", block.name, pin));
            il.push_str(&format!("ST {}\n", target));
        }
    }

    il.trim_end().to_string()
}

// ── Public API ──

/// Compile FBD (CFC text format) source to IEC 61131-3 IL text.
///
/// Returns `Err(String)` if the source is malformed.
///
/// # Example
///
/// ```ignore
/// let il = audesys_fbd_compiler::fbd_compile(
///     "BLOCK ton1 TON\n\nton1.IN := x\nton1.PT := 500\n"
/// ).unwrap();
/// assert!(il.contains("CAL ton1"));
/// ```
pub fn fbd_compile(source: &str) -> Result<String, String> {
    let lines = tokenize(source);
    if lines.is_empty() {
        return Err("empty FBD source".to_string());
    }
    let blocks = parse_blocks(&lines)?;
    Ok(generate_il(&blocks))
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_single_ton() {
        let src = "BLOCK ton1 TON";
        let lines = tokenize(src);
        let blocks = parse_blocks(&lines).unwrap();
        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].name, "ton1");
        assert_eq!(blocks[0].kind, FbKind::Ton);
    }

    #[test]
    fn test_fbd_to_il_ton() {
        let src = "BLOCK ton1 TON\n\nton1.IN := x\nton1.PT := 500\n\nresult := ton1.Q";
        let il = fbd_compile(src).unwrap();
        assert!(il.contains("; BLOCK ton1 TON"));
        assert!(il.contains("LD x"));
        assert!(il.contains("ST ton1.IN"));
        assert!(il.contains("LD 500"));
        assert!(il.contains("ST ton1.PT"));
        assert!(il.contains("CAL ton1"));
        assert!(il.contains("LD ton1.Q"));
        assert!(il.contains("ST result"));
    }

    #[test]
    fn test_fbd_to_il_two_blocks() {
        let src = "\
BLOCK ton1 TON

ton1.IN := x
ton1.PT := 500

BLOCK cnt1 CTU

cnt1.CU := ton1.Q
cnt1.PV := 10

result := cnt1.Q
";
        let il = fbd_compile(src).unwrap();
        assert!(il.contains("CAL ton1"));
        assert!(il.contains("CAL cnt1"));
        assert!(il.contains("LD ton1.Q"));
        assert!(il.contains("ST cnt1.CU"));
        assert!(il.contains("LD cnt1.Q"));
        assert!(il.contains("ST result"));
    }

    #[test]
    fn test_fbd_sr_block() {
        let src = "BLOCK sr1 SR\n\nsr1.S1 := start\nsr1.R := reset\n\nout1 := sr1.Q1";
        let il = fbd_compile(src).unwrap();
        assert!(il.contains("CAL sr1"));
        assert!(il.contains("LD start"));
        assert!(il.contains("ST sr1.S1"));
        assert!(il.contains("LD reset"));
        assert!(il.contains("ST sr1.R"));
        assert!(il.contains("LD sr1.Q1"));
        assert!(il.contains("ST out1"));
    }

    #[test]
    fn test_unknown_block_kind() {
        let src = "BLOCK bad XYZ";
        let result = fbd_compile(src);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("unknown block kind"));
    }

    #[test]
    fn test_empty_source() {
        let result = fbd_compile("");
        assert!(result.is_err());
    }

    #[test]
    fn test_missing_block_name() {
        let src = "BLOCK ";
        let result = fbd_compile(src);
        assert!(result.is_err());
    }

    #[test]
    fn test_no_blocks() {
        // Just outputs without blocks — treated as error (no blocks or outputs found)
        let src = "result := 42";
        let result = fbd_compile(src);
        assert!(result.is_err());
    }

    #[test]
    fn test_block_with_all_inputs() {
        let src = "BLOCK cnt1 CTUD\n\ncnt1.CU := up\ncnt1.CD := down\ncnt1.R := reset\ncnt1.LD := load\ncnt1.PV := 100";
        let il = fbd_compile(src).unwrap();
        assert!(il.contains("CAL cnt1"));
        assert!(il.contains("LD up"));
        assert!(il.contains("ST cnt1.CU"));
        assert!(il.contains("LD down"));
        assert!(il.contains("ST cnt1.CD"));
        assert!(il.contains("LD reset"));
        assert!(il.contains("ST cnt1.R"));
        assert!(il.contains("LD load"));
        assert!(il.contains("ST cnt1.LD"));
        assert!(il.contains("LD 100"));
        assert!(il.contains("ST cnt1.PV"));
    }

    #[test]
    fn test_rtrig_block() {
        let src = "BLOCK rt1 R_TRIG\n\nrt1.CLK := sensor\n\ntrigged := rt1.Q";
        let il = fbd_compile(src).unwrap();
        assert!(il.contains("CAL rt1"));
        assert!(il.contains("LD sensor"));
        assert!(il.contains("ST rt1.CLK"));
        assert!(il.contains("LD rt1.Q"));
        assert!(il.contains("ST trigged"));
    }

    #[test]
    fn test_ftrig_block() {
        let src = "BLOCK ft1 F_TRIG\n\nft1.CLK := sensor\n\nedge := ft1.Q";
        let il = fbd_compile(src).unwrap();
        assert!(il.contains("CAL ft1"));
        assert!(il.contains("LD sensor"));
        assert!(il.contains("ST ft1.CLK"));
        assert!(il.contains("LD ft1.Q"));
        assert!(il.contains("ST edge"));
    }

    #[test]
    fn test_output_connection() {
        let src = "BLOCK ton1 TON\n\nton1.IN := input1\n\nresult := ton1.Q";
        let il = fbd_compile(src).unwrap();
        assert!(il.contains("LD input1"));
        assert!(il.contains("ST ton1.IN"));
        assert!(il.contains("CAL ton1"));
        assert!(il.contains("LD ton1.Q"));
        assert!(il.contains("ST result"));
    }

    #[test]
    fn test_comment_skip() {
        let src = "// This is a comment\n; Also a comment\nBLOCK ton1 TON\n\nton1.IN := x";
        let il = fbd_compile(src).unwrap();
        assert!(il.contains("CAL ton1"));
        assert!(!il.contains("comment"));
        assert!(!il.contains("This is"));
        assert!(!il.contains("Also"));
    }

    #[test]
    fn test_block_reuse() {
        let src = "\
BLOCK ton1 TON

ton1.IN := x

BLOCK cnt1 CTU

cnt1.CU := ton1.Q

BLOCK sr1 SR

sr1.S1 := ton1.Q

result1 := ton1.Q
result2 := cnt1.Q
result3 := sr1.Q1
";
        let il = fbd_compile(src).unwrap();
        assert!(il.contains("CAL ton1"));
        assert!(il.contains("CAL cnt1"));
        assert!(il.contains("CAL sr1"));
        // ton1.Q used for cnt1.CU and sr1.S1 and output result1
        let ton_q_count = il.matches("ton1.Q").count();
        assert_eq!(ton_q_count, 3, "ton1.Q should appear 3 times (cnt1.CU, sr1.S1, result1)");
    }

    #[test]
    fn test_ctu_basic() {
        let src =
            "BLOCK cnt1 CTU\n\ncnt1.CU := pulse\ncnt1.R := reset\ncnt1.PV := 10\n\ncount := cnt1.Q";
        let il = fbd_compile(src).unwrap();
        assert!(il.contains("CAL cnt1"));
        assert!(il.contains("LD pulse"));
        assert!(il.contains("ST cnt1.CU"));
        assert!(il.contains("LD reset"));
        assert!(il.contains("ST cnt1.R"));
        assert!(il.contains("ST count"));
    }

    #[test]
    fn test_ctud_basic() {
        let src = "BLOCK c1 CTUD\n\nc1.CU := up\nc1.CD := down\nc1.R := reset\nc1.LD := load_val\nc1.PV := 100\n\nq_up := c1.QU\nq_down := c1.QD\ncv := c1.CV";
        let il = fbd_compile(src).unwrap();
        assert!(il.contains("CAL c1"));
        assert!(il.contains("LD up"));
        assert!(il.contains("ST c1.CU"));
        assert!(il.contains("LD down"));
        assert!(il.contains("ST c1.CD"));
        assert!(il.contains("LD load_val"));
        assert!(il.contains("ST c1.LD"));
        assert!(il.contains("ST q_up"));
        assert!(il.contains("ST q_down"));
        assert!(il.contains("ST cv"));
    }

    #[test]
    fn test_rs_block() {
        let src = "BLOCK lock RS\n\nlock.S := set_val\nlock.R1 := reset_val\n\nq := lock.Q1";
        let il = fbd_compile(src).unwrap();
        assert!(il.contains("CAL lock"));
        assert!(il.contains("LD set_val"));
        assert!(il.contains("ST lock.S"));
        assert!(il.contains("ST lock.R1"));
        assert!(il.contains("LD lock.Q1"));
        assert!(il.contains("ST q"));
    }

    #[test]
    fn test_tof_block() {
        let src = "BLOCK delay TOF\n\ndelay.IN := input\n\ndelay.PT := 1000\n\ndone := delay.Q\nelapsed := delay.ET";
        let il = fbd_compile(src).unwrap();
        assert!(il.contains("CAL delay"));
        assert!(il.contains("LD 1000"));
        assert!(il.contains("ST delay.PT"));
        assert!(il.contains("LD delay.Q"));
        assert!(il.contains("ST done"));
        assert!(il.contains("LD delay.ET"));
        assert!(il.contains("ST elapsed"));
    }

    #[test]
    fn test_tp_block() {
        let src = "BLOCK pulse TP\n\npulse.IN := trigger\npulse.PT := 200\n\nout := pulse.Q\net := pulse.ET";
        let il = fbd_compile(src).unwrap();
        assert!(il.contains("CAL pulse"));
        assert!(il.contains("LD trigger"));
        assert!(il.contains("ST pulse.IN"));
        assert!(il.contains("ST pulse.PT"));
        assert!(il.contains("ST out"));
        assert!(il.contains("ST et"));
    }

    #[test]
    fn test_ctd_block() {
        let src = "BLOCK down CTD\n\ndown.CD := signal\ndown.LD := load_val\ndown.PV := 50\n\nq := down.Q\ncv := down.CV";
        let il = fbd_compile(src).unwrap();
        assert!(il.contains("CAL down"));
        assert!(il.contains("LD signal"));
        assert!(il.contains("ST down.CD"));
        assert!(il.contains("LD load_val"));
        assert!(il.contains("ST down.LD"));
        assert!(il.contains("ST q"));
        assert!(il.contains("ST cv"));
    }

    #[test]
    fn test_multiple_outputs() {
        let src = "\
BLOCK ton1 TON
ton1.IN := x

BLOCK cnt1 CTU
cnt1.CU := ton1.Q

a := ton1.Q
b := cnt1.Q
c := ton1.Q
";
        let il = fbd_compile(src).unwrap();
        assert!(il.contains("ST a"));
        assert!(il.contains("ST b"));
        assert!(il.contains("ST c"));
    }
}
