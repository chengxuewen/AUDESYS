//! AUDESYS IEC 61131-3 SFC (Sequential Function Chart) compiler.
//!
//! Compiles SFC text to IL text, which feeds into the `audesys-il-compiler`
//! for full HAL IR compilation.
//!
//! # SFC text format
//!
//! ```text
//! STEP Init
//!   ACTION N: x := 0;
//! END_STEP
//! TRANSITION FROM Init TO Run : start = TRUE
//! END_TRANSITION
//! STEP Run
//!   ACTION P1: x := x + 1;
//! END_STEP
//! TRANSITION FROM Run TO Done : x >= 10
//! END_TRANSITION
//! STEP Done
//!   ACTION N: done := TRUE;
//! END_STEP
//! ```
//!
//! Action qualifiers: N (non-stored), S (set), R (reset),
//! P1 (pulse rising), P0 (pulse falling).
//!
//! # Phase 1 constraints
//!
//! Sequential steps only — no parallel or alternative branches.

/// An action within an SFC step.
#[derive(Debug, Clone)]
#[allow(dead_code)] // ponytail: parsed for Phase 2 qualifier semantics, unused in Phase 1 IL gen
struct Action {
    qualifier: char,
    body: String,
}

/// A transition between two SFC steps.
#[derive(Debug, Clone)]
struct Transition {
    from: String,
    to: String,
    condition: String,
}

/// A parsed SFC step with actions and an optional transition.
#[derive(Debug, Clone)]
struct Step {
    name: String,
    actions: Vec<Action>,
    transition: Option<Transition>,
}

// --- Tokenizer ---

#[derive(Debug, Clone, PartialEq)]
enum Token {
    StepName(String),
    Action { qualifier: char, body: String },
    EndStep,
    Transition { from: String, to: String, condition: String },
    EndTransition,
}

fn tokenize(source: &str) -> Vec<Token> {
    let mut tokens = Vec::new();
    let lines: Vec<&str> = source.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i].trim();
        let upper = line.to_uppercase();

        if upper.starts_with("END_STEP") {
            tokens.push(Token::EndStep);
            i += 1;
            continue;
        }

        if upper.starts_with("END_TRANSITION") {
            tokens.push(Token::EndTransition);
            i += 1;
            continue;
        }

        if upper.starts_with("STEP ") {
            // ponytail: simple split, no nested parsing
            let name = line[5..].trim().to_string();
            if name.is_empty() {
                i += 1;
                continue;
            }
            tokens.push(Token::StepName(name));
            i += 1;
            continue;
        }

        if upper.starts_with("ACTION ") {
            let rest = &line["ACTION ".len()..].trim();
            if let Some(colon_idx) = rest.find(':') {
                let qualifier = rest[..colon_idx].trim();
                let body = rest[colon_idx + 1..].trim();
                if let Some(q) = qualifier.chars().next() {
                    tokens.push(Token::Action { qualifier: q, body: body.to_string() });
                }
            }
            i += 1;
            continue;
        }

        if upper.starts_with("TRANSITION ") {
            let rest = &line["TRANSITION ".len()..].trim();
            // Parse: FROM <from> TO <to> : <condition>
            // ponytail: expect uppercase FROM and TO as delimiters
            let rest_upper = rest.to_uppercase();
            if let Some(from_start) = rest_upper.find("FROM ") {
                let after_from = &rest[from_start + "FROM ".len()..];
                if let Some(to_pos) = after_from.to_uppercase().find(" TO ") {
                    let from = after_from[..to_pos].trim().to_string();
                    let after_to = &after_from[to_pos + " TO ".len()..];
                    if let Some(colon_pos) = after_to.find(':') {
                        let to = after_to[..colon_pos].trim().to_string();
                        let condition = after_to[colon_pos + 1..].trim().to_string();
                        tokens.push(Token::Transition { from, to, condition });
                    }
                }
            }
            i += 1;
            continue;
        }

        i += 1;
    }

    tokens
}

// --- Parser ---

fn parse_steps(tokens: &[Token]) -> Result<Vec<Step>, String> {
    let mut steps: Vec<Step> = Vec::new();
    let mut current_step: Option<Step> = None;

    for token in tokens {
        match token {
            Token::StepName(name) => {
                if let Some(step) = current_step.take() {
                    steps.push(step);
                }
                current_step =
                    Some(Step { name: name.clone(), actions: Vec::new(), transition: None });
            }
            Token::Action { qualifier, body } => {
                if let Some(ref mut step) = current_step {
                    step.actions.push(Action { qualifier: *qualifier, body: body.clone() });
                }
            }
            Token::EndStep => {
                if let Some(step) = current_step.take() {
                    steps.push(step);
                }
            }
            Token::Transition { .. } | Token::EndTransition => {
                // transitions handled in a separate pass
            }
        }
    }

    // flush any unclosed step
    if let Some(step) = current_step {
        steps.push(step);
    }

    if steps.is_empty() {
        return Err("no SFC steps found".to_string());
    }

    Ok(steps)
}

fn parse_transitions(tokens: &[Token]) -> Vec<Transition> {
    let mut transitions = Vec::new();

    for token in tokens {
        if let Token::Transition { from, to, condition } = token {
            transitions.push(Transition {
                from: from.clone(),
                to: to.clone(),
                condition: condition.clone(),
            });
        }
    }

    transitions
}

fn link_transitions(steps: &mut [Step], transitions: &[Transition]) -> Result<(), String> {
    for tr in transitions {
        let from_idx = steps.iter().position(|s| s.name == tr.from);
        let to_exists = steps.iter().any(|s| s.name == tr.to);

        let Some(idx) = from_idx else {
            return Err(format!("step '{}' not found for transition FROM", tr.from));
        };

        if !to_exists {
            return Err(format!("step '{}' not found for transition TO", tr.to));
        }

        if steps[idx].transition.is_some() {
            // ponytail: skip duplicate transitions (no parallel branches in Phase 1)
            continue;
        }

        steps[idx].transition = Some(tr.clone());
    }

    Ok(())
}

// --- Expression to IL mapping ---

/// Map a simple SFC action body like `x := x + 1` to IL instructions.
/// Also handles raw IL opcodes passed through.
fn action_body_to_il(body: &str) -> String {
    let b = body.trim().trim_end_matches(';');

    // ponytail: if body starts with a known IL opcode, pass through as-is
    let il_opcodes = [
        "LD ", "LDN ", "ST ", "S ", "R ", "AND ", "ANDN ", "OR ", "ORN ", "XOR ", "XORN ", "ADD ",
        "SUB ", "MUL ", "DIV ", "GT ", "GE ", "EQ ", "NE ", "LT ", "LE ", "JMP ", "JMPC ",
        "JMPCN ", "CAL ", "RET ", "NOT ", "NOP ",
    ];
    if il_opcodes.iter().any(|prefix| b.to_uppercase().starts_with(prefix)) {
        return b.to_string();
    }

    // Try assignment syntax: x := expr
    if let Some(assign_idx) = b.find(":=") {
        let var = b[..assign_idx].trim();
        let expr = b[assign_idx + 2..].trim();
        return expr_to_il(expr, var);
    }

    // Fallback: emit as comment
    format!("; unparsed action: {b}")
}

/// Convert a simple expression to IL, storing result in target_var.
fn expr_to_il(expr: &str, target_var: &str) -> String {
    let e = expr.trim();

    // TRUE / FALSE constants
    if e.eq_ignore_ascii_case("TRUE") {
        return format!("LD 1\nST {target_var}");
    }
    if e.eq_ignore_ascii_case("FALSE") {
        return format!("LD 0\nST {target_var}");
    }

    // Numeric literal: just LD + ST
    if e.chars().all(|c| c.is_ascii_digit()) {
        return format!("LD {e}\nST {target_var}");
    }

    // NOT var
    if let Some(inner) = e.strip_prefix("NOT ") {
        let inner = inner.trim();
        return format!("LD {inner}\nNOT\nST {target_var}");
    }

    // Variable name only: y := x → LD x; ST y
    if is_identifier(e) {
        return format!("LD {e}\nST {target_var}");
    }

    // Binary expression: var op rhs
    if let Some((left, op, right)) = split_binary_expression(e) {
        let il_op = il_op_for(op);
        if il_op.is_none() {
            return format!("; unparsed binary: {expr} → ST {target_var}");
        }
        let il_op = il_op.unwrap();

        // Determine whether the right side is a literal or variable
        let right_val = right.trim();
        return format!("LD {left}\n{il_op} {right_val}\nST {target_var}");
    }

    // Fallback
    format!("; unparsed expr: {expr} → ST {target_var}")
}

/// Convert a transition condition expression to IL that leaves a boolean
/// on the accumulator. The caller appends JMPC/JMP.
fn transition_condition_to_il(condition: &str) -> String {
    let c = condition.trim();

    // TRUE / FALSE
    if c.eq_ignore_ascii_case("TRUE") {
        return "LD 1".to_string();
    }
    if c.eq_ignore_ascii_case("FALSE") {
        return "LD 0".to_string();
    }

    // Numeric: LD n
    if c.chars().all(|ch| ch.is_ascii_digit()) {
        return format!("LD {c}");
    }

    // Single variable: LD var (truthy check)
    if is_identifier(c) {
        return format!("LD {c}\nNE 0");
    }

    // NOT var
    if let Some(inner) = c.strip_prefix("NOT ") {
        let inner = inner.trim();
        return format!("LD {inner}\nNOT");
    }

    // Binary comparison: left op right
    if let Some((left, op, right)) = split_binary_expression(c) {
        let il_op = il_op_for(op);
        if let Some(il_op) = il_op {
            return format!("LD {left}\n{il_op} {right}");
        }
    }

    // Fallback
    format!("; unparsed condition: {c}")
}

/// Split a binary expression like `x + 1`, `x >= 10`, `y >= x` into (left, op, right).
fn split_binary_expression(expr: &str) -> Option<(&str, &str, &str)> {
    // Try multi-char operators first (>=, <=, <>), then single-char
    let multi_ops = [">=", "<=", "<>"];
    for op in &multi_ops {
        if let Some(idx) = expr.find(op) {
            let left = expr[..idx].trim();
            let right = expr[idx + op.len()..].trim();
            return Some((left, op, right));
        }
    }

    let single_ops = ['=', '<', '>', '+', '-', '*', '/'];
    for op in &single_ops {
        let op_str = op.to_string();
        // Don't split on '=' inside ':=' or '!='
        if op_str == "=" {
            if let Some(idx) = expr.find(" = ") {
                let left = expr[..idx].trim();
                let right = expr[idx + 3..].trim();
                return Some((left, "=", right));
            }
            // Also match single '=' not inside :=
            if let Some(idx) = expr.rfind('=') {
                if idx > 0 && expr.as_bytes().get(idx - 1) == Some(&b':') {
                    continue; // skip :=
                }
                if idx + 1 < expr.len() && expr.as_bytes().get(idx + 1) == Some(&b'=') {
                    continue; // skip ==
                }
                let left = expr[..idx].trim();
                let right = expr[idx + 1..].trim();
                return Some((left, "=", right));
            }
        } else {
            if let Some(idx) = expr.find(op_str.as_str()) {
                let left = expr[..idx].trim();
                let right = expr[idx + op_str.len()..].trim();
                let op_len = op_str.len();
                return Some((left, &expr[idx..idx + op_len], right));
            }
        }
    }

    None
}

/// Map a comparison/arithmetic operator to its IL mnemonic.
fn il_op_for(op: &str) -> Option<&'static str> {
    match op {
        "+" => Some("ADD"),
        "-" => Some("SUB"),
        "*" => Some("MUL"),
        "/" => Some("DIV"),
        "=" => Some("EQ"),
        "<>" => Some("NE"),
        "<" => Some("LT"),
        "<=" => Some("LE"),
        ">" => Some("GT"),
        ">=" => Some("GE"),
        _ => None,
    }
}

fn is_identifier(s: &str) -> bool {
    let s = s.trim();
    if s.is_empty() {
        return false;
    }
    let first = s.chars().next().unwrap();
    if !first.is_ascii_alphabetic() && first != '_' {
        return false;
    }
    s.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
}

// --- Codegen ---

/// Generate IL source from parsed steps.
fn generate_il(steps: &[Step]) -> Result<String, String> {
    if steps.is_empty() {
        return Err("no steps to generate IL from".to_string());
    }

    let mut output = String::new();
    output.push_str("; SFC compiled to IL\n");

    // Initial jump to first step
    let init_label = steps[0].name.to_uppercase();
    output.push_str(&format!("JMP {init_label}\n\n"));

    let step_count = steps.len();

    for (idx, step) in steps.iter().enumerate() {
        let label = step.name.to_uppercase();
        output.push_str(&format!("{label}:\n"));

        // Generate IL for each action
        for action in &step.actions {
            let il = action_body_to_il(&action.body);
            for il_line in il.lines() {
                output.push_str(&format!("  {il_line}\n"));
            }
        }

        // Generate transition or HALT
        if let Some(tr) = &step.transition {
            let cond_il = transition_condition_to_il(&tr.condition);
            for cond_line in cond_il.lines() {
                output.push_str(&format!("  {cond_line}\n"));
            }
            output.push_str(&format!("  JMPC {}\n", tr.to.to_uppercase()));
            // Jump back to self if condition false (stays in current step)
            output.push_str(&format!("  JMP {}\n", label));
        } else if idx == step_count - 1 {
            // Last step with no transition → HALT
            output.push_str("  HALT\n");
        } else {
            return Err(format!(
                "step '{}' has no transition (only the final step may lack a transition)",
                step.name
            ));
        }

        output.push('\n');
    }

    Ok(output)
}

// --- Public API ---

/// Compile SFC (Sequential Function Chart) source text to IEC 61131-3 IL text.
///
/// Returns `Err(String)` if the source is malformed or missing required steps/transitions.
pub fn sfc_compile(source: &str) -> Result<String, String> {
    let tokens = tokenize(source);
    let mut steps = parse_steps(&tokens)?;
    let transitions = parse_transitions(&tokens);
    link_transitions(&mut steps, &transitions)?;
    generate_il(&steps)
}

// --- Tests ---

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_two_steps() {
        let src = "STEP Init\n  ACTION N: x := 0;\nEND_STEP\nTRANSITION FROM Init TO Run : start = TRUE\nEND_TRANSITION\nSTEP Run\n  ACTION P1: x := x + 1;\nEND_STEP\n";
        let il = sfc_compile(src).unwrap();
        assert!(il.contains("INIT:"));
        assert!(il.contains("RUN:"));
        assert!(il.contains("JMPC RUN"));
        assert!(il.contains("JMP INIT"));
        assert!(il.contains("HALT"));
    }

    #[test]
    fn test_three_steps() {
        let src = "\
STEP Init
  ACTION N: x := 0;
END_STEP
TRANSITION FROM Init TO Run : start = TRUE
END_TRANSITION
STEP Run
  ACTION P1: x := x + 1;
END_STEP
TRANSITION FROM Run TO Done : x >= 10
END_TRANSITION
STEP Done
  ACTION N: done := TRUE;
END_STEP";
        let il = sfc_compile(src).unwrap();
        assert!(il.contains("INIT:"));
        assert!(il.contains("RUN:"));
        assert!(il.contains("DONE:"));
        assert!(il.contains("JMPC RUN"));
        assert!(il.contains("JMPC DONE"));
        assert!(il.contains("HALT"));
        // Verify action mapping
        assert!(il.contains("LD 0"));
        assert!(il.contains("ST x"));
        assert!(il.contains("ADD 1"));
        assert!(il.contains("LD 1"));
        assert!(il.contains("ST done"));
    }

    #[test]
    fn test_action_body_mapping() {
        // x := 0 → LD 0; ST x
        let il = action_body_to_il("x := 0");
        assert_eq!(il, "LD 0\nST x");

        // x := x + 1 → LD x; ADD 1; ST x
        let il2 = action_body_to_il("x := x + 1");
        assert_eq!(il2, "LD x\nADD 1\nST x");
    }

    #[test]
    fn test_transition_condition() {
        let il = transition_condition_to_il("x >= 10");
        assert_eq!(il, "LD x\nGE 10");

        let il2 = transition_condition_to_il("start = TRUE");
        assert_eq!(il2, "LD start\nEQ TRUE");
    }

    #[test]
    fn test_action_qualifiers() {
        let src = "\
STEP TestStep
  ACTION N: x := 0;
  ACTION P1: y := 1;
END_STEP
";
        let il = sfc_compile(src).unwrap();
        assert!(il.contains("LD 0"));
        assert!(il.contains("ST x"));
        assert!(il.contains("LD 1"));
        assert!(il.contains("ST y"));
        assert!(il.contains("HALT"));
    }

    #[test]
    fn test_single_step() {
        let src = "STEP Only\n  ACTION N: x := 0;\nEND_STEP\n";
        let il = sfc_compile(src).unwrap();
        assert!(il.contains("ONLY:"));
        assert!(il.contains("LD 0"));
        assert!(il.contains("ST x"));
        assert!(il.contains("HALT"));
    }

    #[test]
    fn test_step_with_multiple_actions() {
        let src = "\
STEP MultiAction
  ACTION N: a := 0;
  ACTION N: b := 1;
  ACTION N: c := 2;
END_STEP
";
        let il = sfc_compile(src).unwrap();
        assert!(il.contains("ST a"));
        assert!(il.contains("ST b"));
        assert!(il.contains("ST c"));
    }

    #[test]
    fn test_true_constant() {
        let il = action_body_to_il("done := TRUE");
        assert_eq!(il, "LD 1\nST done");

        let il2 = action_body_to_il("y := FALSE");
        assert_eq!(il2, "LD 0\nST y");
    }

    #[test]
    fn test_not_expression() {
        let il = action_body_to_il("x := NOT x");
        assert_eq!(il, "LD x\nNOT\nST x");
    }

    #[test]
    fn test_semicolons() {
        let il = action_body_to_il("x := 0;");
        assert_eq!(il, "LD 0\nST x");

        let il2 = action_body_to_il("x := x + 1");
        assert_eq!(il2, "LD x\nADD 1\nST x");
    }

    #[test]
    fn test_empty_step() {
        let src = "\
STEP Empty
END_STEP
STEP Next
  ACTION N: x := 1;
END_STEP
TRANSITION FROM Empty TO Next : TRUE
END_TRANSITION
";
        let il = sfc_compile(src).unwrap();
        assert!(il.contains("EMPTY:"));
        assert!(il.contains("JMPC NEXT"));
        // No action IL under EMPTY (only transition condition)
        assert!(il.contains("NEXT:"));
    }

    #[test]
    fn test_multiple_transitions() {
        // Two transitions FROM different steps
        let src = "\
STEP First
  ACTION N: a := 1;
END_STEP
TRANSITION FROM First TO Second : x > 5
END_TRANSITION
STEP Second
  ACTION N: b := 2;
END_STEP
TRANSITION FROM Second TO Third : y < 10
END_TRANSITION
STEP Third
  ACTION N: c := 3;
END_STEP
";
        let il = sfc_compile(src).unwrap();
        assert!(il.contains("FIRST:"));
        assert!(il.contains("JMPC SECOND"));
        assert!(il.contains("SECOND:"));
        assert!(il.contains("JMPC THIRD"));
        assert!(il.contains("THIRD:"));
        assert!(il.contains("HALT"));
    }

    #[test]
    fn test_unknown_step_in_transition() {
        let src = "\
STEP Init
  ACTION N: x := 0;
END_STEP
TRANSITION FROM Init TO Nowhere : TRUE
END_TRANSITION
";
        let result = sfc_compile(src);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Nowhere"));
    }

    #[test]
    fn test_orphan_transition() {
        let src = "\
STEP Init
  ACTION N: x := 0;
END_STEP
STEP Run
  ACTION N: y := 1;
END_STEP
TRANSITION FROM Ghost TO Run : TRUE
END_TRANSITION
";
        let result = sfc_compile(src);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Ghost"));
    }

    #[test]
    fn test_missing_initial_step() {
        let result = sfc_compile("");
        assert!(result.is_err());
    }

    #[test]
    fn test_raw_il_pass_through() {
        let il = action_body_to_il("LD x");
        assert_eq!(il, "LD x");

        let il2 = action_body_to_il("ST y");
        assert_eq!(il2, "ST y");

        let il3 = action_body_to_il("ADD 1");
        assert_eq!(il3, "ADD 1");
    }

    #[test]
    fn test_arithmetic_operators() {
        let il = action_body_to_il("y := x - 1");
        assert!(il.contains("SUB 1"));
        assert!(il.contains("ST y"));

        let il2 = action_body_to_il("z := a * 2");
        assert!(il2.contains("MUL 2"));
        assert!(il2.contains("ST z"));

        let il3 = action_body_to_il("w := b / 4");
        assert!(il3.contains("DIV 4"));
        assert!(il3.contains("ST w"));
    }

    #[test]
    fn test_variable_copy() {
        let il = action_body_to_il("y := x");
        assert_eq!(il, "LD x\nST y");
    }

    #[test]
    fn test_nested_steps_with_transitions() {
        // Ensure each step correctly chains to the next
        let src = "\
STEP One
  ACTION N: a := 1;
END_STEP
TRANSITION FROM One TO Two : a = 1
END_TRANSITION
STEP Two
  ACTION N: b := 2;
END_STEP
TRANSITION FROM Two TO Three : b = 2
END_TRANSITION
STEP Three
  ACTION N: c := 3;
END_STEP
";
        let il = sfc_compile(src).unwrap();
        // Each step should JMPC to the next
        let one_idx = il.find("JMPC TWO").expect("JMPC Two missing");
        let two_idx = il.find("JMPC THREE").expect("JMPC Three missing");
        assert!(one_idx < two_idx, "One→Two should appear before Two→Three");
    }
}
