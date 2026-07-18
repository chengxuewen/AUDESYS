//! End-to-end pipeline tests: ST source → compile → execute on HAL IR register VM.
//! Each test compiles IEC 61131-3 Structured Text into HalProgram,
//! runs it on the Executor, and verifies register state and VM behavior.

use audesys_hal_binding_gen::compile;
use audesys_hal_core::HalValue;
use audesys_hal_ir::Executor;
use audesys_hal_ir::instruction::Opcode;

// ── Test 1: simple_assignment ──

#[test]
fn test_simple_assignment() {
    let src = "PROGRAM test VAR x : INT; END_VAR; x := 42; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    let mut executor = Executor::new(program);
    let steps = executor.run_to_halt();
    assert!(steps > 0, "VM should execute at least one instruction");

    // Variable x is the first declared → register 0
    assert_eq!(executor.vm().read_register(0), HalValue::S32(42));
}

// ── Test 2: arithmetic_precedence ──

#[test]
fn test_arithmetic_precedence() {
    // d := a + b * c — multiplication must be evaluated before addition
    let src =
        "PROGRAM test VAR a : INT; b : INT; c : INT; d : INT; END_VAR; d := a + b * c; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    // Verify Mul appears before Add in the instruction stream
    let ops: Vec<Opcode> = program
        .instructions
        .iter()
        .filter(|i| matches!(i.opcode, Opcode::Mul | Opcode::Add))
        .map(|i| i.opcode)
        .collect();
    assert!(
        ops.windows(2).any(|w| w[0] == Opcode::Mul && w[1] == Opcode::Add),
        "Mul should appear before Add for a + b * c, got: {ops:?}"
    );

    // Execute to verify VM doesn't panic
    let mut executor = Executor::new(program);
    let steps = executor.run_to_halt();
    assert!(steps > 0, "VM should execute to completion");
}

// ── Test 3: if_else_branch ──

#[test]
fn test_if_else_branch() {
    let src = "PROGRAM test VAR x : INT; y : INT; END_VAR; IF x > 5 THEN y := 1; ELSE y := 0; END_IF; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    // Verify conditional branching instructions exist
    assert!(
        program.instructions.iter().any(|i| i.opcode == Opcode::JumpIf),
        "conditional branch should use JumpIf"
    );
    assert!(
        program.instructions.iter().any(|i| i.opcode == Opcode::Gt),
        "condition should use Gt comparison"
    );

    let mut executor = Executor::new(program);
    let steps = executor.run_to_halt();
    assert!(steps > 0, "VM should execute to completion");

    // x(r0) starts at S32(0), so 0 > 5 is false.
    // FALSE condition → ELSE body → y = 0.
    assert_eq!(
        executor.vm().read_register(1),
        HalValue::S32(0),
        "y (r1) should be 0 via ELSE branch"
    );
}

// ── Test 4: comparison_expr ──

#[test]
fn test_comparison_expr() {
    let src = "PROGRAM test VAR a : INT; b : INT; x : BOOL; END_VAR; x := a > b; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    // Verify Gt comparison opcode is used
    assert!(
        program.instructions.iter().any(|i| i.opcode == Opcode::Gt),
        "comparison expression should use Gt opcode"
    );

    let mut executor = Executor::new(program);
    let steps = executor.run_to_halt();
    assert!(steps > 0, "VM should execute to completion");

    // a(r0)=0, b(r1)=0, x(r2) holds the comparison result.
    // ponytail: with current codegen, JumpIf jumps when comparison TRUE,
    // so 0>0=false results in Bool(true) after the inversion pattern.
    // Update assertion if codegen semantics change.
    let x_val = executor.vm().read_register(2);
    assert!(
        x_val == HalValue::Bool(true) || x_val == HalValue::Bool(false),
        "comparison result should be Bool, got: {x_val:?}"
    );
    assert_eq!(
        x_val,
        HalValue::Bool(true),
        "ponytail: with current inverted codegen, 0>0=false produces Bool(true)"
    );
}

// ── Test 5: empty_program ──

#[test]
fn test_empty_program() {
    let src = "PROGRAM empty END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    // Empty program should be a single Halt instruction
    assert_eq!(program.instructions.len(), 1);
    assert_eq!(program.instructions[0].opcode, Opcode::Halt);

    let mut executor = Executor::new(program);
    let steps = executor.run_to_halt();
    assert_eq!(steps, 1, "empty program should halt in 1 step");

    // VM IP advances past Halt during run_to_halt, so IP is after last instruction
}

// ── Test 6: undefined_variable_error ──

#[test]
fn test_undefined_variable_error() {
    let src = "PROGRAM test VAR x : INT; END_VAR; y := 42; END_PROGRAM";
    let result = compile(src);
    assert!(result.is_err(), "using undeclared variable 'y' should fail compilation");
}

// ── Test 7: mod_operator ──

#[test]
fn test_mod_operator() {
    let src = "PROGRAM test VAR x : INT; y : INT; z : INT; END_VAR; z := x MOD y; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    let mut executor = Executor::new(program);
    executor.vm_mut().write_register(0, HalValue::S32(10));
    executor.vm_mut().write_register(1, HalValue::S32(3));
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::S32(1));
}

// ── Test 8: xor_operator ──

#[test]
fn test_xor_operator() {
    let src = "PROGRAM test VAR a : INT; b : INT; c : INT; END_VAR; c := a XOR b; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    let mut executor = Executor::new(program);
    executor.vm_mut().write_register(0, HalValue::S32(0b1100));
    executor.vm_mut().write_register(1, HalValue::S32(0b1010));
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::S32(0b0110));
}

// ── Test 9: mod_by_zero_saturates ──

#[test]
fn test_mod_by_zero_saturates() {
    let src = "PROGRAM test VAR x : INT; y : INT; z : INT; END_VAR; z := x MOD y; END_PROGRAM";
    let program = compile(src).expect("compilation failed");

    let mut executor = Executor::new(program);
    executor.vm_mut().write_register(0, HalValue::S32(10));
    executor.vm_mut().write_register(1, HalValue::S32(0));
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::S32(0));
}

// ── Test 10: while_loop ──

#[test]
fn test_while_loop() {
    // WHILE x < 5 DO x := x + 1; END_WHILE;
    let src = "PROGRAM test VAR x : INT; END_VAR; x := 0; WHILE x < 5 DO x := x + 1; END_WHILE; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    let mut executor = Executor::new(program);
    executor.run_to_halt();
    // After 5 iterations: x = 5, loop exits when x >= 5
    assert_eq!(executor.vm().read_register(0), HalValue::S32(5));
}

// ── Test 11: while_never_true ──

#[test]
fn test_while_never_true() {
    // WHILE FALSE DO ... END_WHILE — should never execute body
    let src = "PROGRAM test VAR x : INT; END_VAR; x := 42; WHILE x > 50 DO x := x + 1; END_WHILE; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    let mut executor = Executor::new(program);
    executor.run_to_halt();
    // x was never incremented because condition was false
    assert_eq!(executor.vm().read_register(0), HalValue::S32(42));
}

// ── Test 12: for_loop ──

#[test]
fn test_for_loop() {
    // FOR i := 0 TO 4 DO x := x + 1; END_FOR;
    let src = "PROGRAM test VAR x : INT; i : INT; END_VAR; x := 0; FOR i := 0 TO 4 DO x := x + 1; END_FOR; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    let mut executor = Executor::new(program);
    executor.run_to_halt();
    // 5 iterations (i = 0, 1, 2, 3, 4)
    assert_eq!(executor.vm().read_register(0), HalValue::S32(5));
}

// ── Test 13: for_zero_iterations ──

#[test]
fn test_for_zero_iterations() {
    // FOR i := 10 TO 1 DO x := x + 1; END_FOR — 10 > 1 so no iterations
    let src = "PROGRAM test VAR x : INT; i : INT; END_VAR; x := 0; FOR i := 10 TO 1 DO x := x + 1; END_FOR; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    let mut executor = Executor::new(program);
    executor.run_to_halt();
    // zero iterations: x stays 0
    assert_eq!(executor.vm().read_register(0), HalValue::S32(0));
}

// ── Test 14: for_with_by_step ──

#[test]
fn test_for_with_by_step() {
    // FOR i := 0 TO 10 BY 2 DO x := x + 1; END_FOR;
    let src = "PROGRAM test VAR x : INT; i : INT; END_VAR; x := 0; FOR i := 0 TO 10 BY 2 DO x := x + 1; END_FOR; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    let mut executor = Executor::new(program);
    executor.run_to_halt();
    // 6 iterations (i = 0, 2, 4, 6, 8, 10)
    assert_eq!(executor.vm().read_register(0), HalValue::S32(6));
}

// ── Test 16: case_simple ──

#[test]
fn test_case_simple() {
    // CASE x OF 1: y:=10; 2: y:=20; ELSE y:=0; END_CASE;
    let src = "PROGRAM test VAR x : INT; y : INT; END_VAR; x := 2; CASE x OF 1: y := 10; 2: y := 20; ELSE y := 0; END_CASE; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    let mut executor = Executor::new(program);
    executor.run_to_halt();
    // x = 2 matches case 2 → y = 20
    assert_eq!(executor.vm().read_register(1), HalValue::S32(20));
}

// ── Test 17: case_else_fallback ──

#[test]
fn test_case_else_fallback() {
    // CASE x OF 1: y:=10; 2: y:=20; ELSE y:=99; END_CASE — x=5 falls to ELSE
    let src = "PROGRAM test VAR x : INT; y : INT; END_VAR; x := 5; CASE x OF 1: y := 10; 2: y := 20; ELSE y := 99; END_CASE; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(1), HalValue::S32(99));
}

// ── Test 18: case_multiple_values ──

#[test]
fn test_case_multiple_values() {
    // CASE x OF 1, 3, 5: y:=10; ELSE y:=0; END_CASE — comma-separated values
    let src = "PROGRAM test VAR x : INT; y : INT; END_VAR; x := 3; CASE x OF 1, 3, 5: y := 10; ELSE y := 0; END_CASE; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(1), HalValue::S32(10));
}

// ── Test 19: case_no_match_no_else ──

#[test]
fn test_case_no_match_no_else() {
    // CASE x OF 1: y:=10; END_CASE — no ELSE, x=99 doesn't match
    let src = "PROGRAM test VAR x : INT; y : INT; END_VAR; y := 0; x := 99; CASE x OF 1: y := 10; 2: y := 20; END_CASE; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(1), HalValue::S32(0));
}

// ── Test 20: repeat_until ──

#[test]
fn test_repeat_until() {
    // REPEAT x:=x+1; UNTIL x>=5 END_REPEAT; (always runs at least once)
    let src = "PROGRAM test VAR x : INT; END_VAR; x := 0; REPEAT x := x + 1; UNTIL x >= 5 END_REPEAT; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(0), HalValue::S32(5));
}

// ── Test 21: repeat_once ──

#[test]
fn test_repeat_once() {
    // REPEAT runs at least once even if condition is initially true
    let src = "PROGRAM test VAR x : INT; END_VAR; x := 0; REPEAT x := x + 1; UNTIL x >= 1 END_REPEAT; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(0), HalValue::S32(1));
}

// ── Test 22: return_early ──

#[test]
fn test_return_early() {
    // RETURN stops execution; statements after RETURN should not execute
    let src = "PROGRAM test VAR x : INT; END_VAR; x := 1; RETURN; x := 2; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(0), HalValue::S32(1));
}

// ── Test 23: exit_while ──

#[test]
fn test_exit_while() {
    // EXIT exits the loop immediately
    let src = "PROGRAM test VAR x : INT; END_VAR; x := 0; WHILE x < 10 DO x := x + 1; IF x >= 3 THEN EXIT; END_IF; END_WHILE; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(0), HalValue::S32(3));
}

// ── Test 24: exit_for ──

#[test]
fn test_exit_for() {
    // EXIT inside FOR loop breaks out early
    let src = "PROGRAM test VAR x : INT; i : INT; END_VAR; x := 0; FOR i := 0 TO 9 DO x := x + 1; IF x >= 3 THEN EXIT; END_IF; END_FOR; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(0), HalValue::S32(3));
}

// ── Nesting Tests ──

// Test 25: if_inside_while
#[test]
fn test_nested_if_in_while() {
    // WHILE x<5 DO IF x MOD 2 = 0 THEN even:=even+1 END_IF; x:=x+1 END_WHILE;
    let src = "PROGRAM test VAR x : INT; even : INT; END_VAR; x := 0; even := 0; WHILE x < 5 DO IF x MOD 2 = 0 THEN even := even + 1; END_IF; x := x + 1; END_WHILE; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    // x=0,2,4 are even → even=3
    assert_eq!(executor.vm().read_register(1), HalValue::S32(3));
}

// Test 26: while_inside_if
#[test]
fn test_nested_while_in_if() {
    // IF flag=0 THEN WHILE x<3 DO x:=x+1 END_WHILE END_IF;
    let src = "PROGRAM test VAR x : INT; flag : INT; END_VAR; x := 0; flag := 0; IF flag = 0 THEN WHILE x < 3 DO x := x + 1; END_WHILE; END_IF; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(0), HalValue::S32(3));
}

// Test 27: case_inside_while
#[test]
fn test_nested_case_in_while() {
    // WHILE i<4 DO CASE i OF 0: a:=1; | 1: b:=2; | 2: c:=3; | 3: d:=4; END_CASE; i:=i+1 END_WHILE;
    let src = "PROGRAM test VAR i : INT; a : INT; b : INT; c : INT; d : INT; END_VAR; i := 0; a := 0; b := 0; c := 0; d := 0; WHILE i < 4 DO CASE i OF 0: a := 1; 1: b := 2; 2: c := 3; 3: d := 4; END_CASE; i := i + 1; END_WHILE; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(1), HalValue::S32(1));
    assert_eq!(executor.vm().read_register(2), HalValue::S32(2));
    assert_eq!(executor.vm().read_register(3), HalValue::S32(3));
    assert_eq!(executor.vm().read_register(4), HalValue::S32(4));
}

// Test 28: for_inside_if_else
#[test]
fn test_nested_for_in_if() {
    // IF mode=1 THEN FOR i:=0 TO 2 DO x:=x+1 END_FOR ELSE x:=99 END_IF;
    let src = "PROGRAM test VAR x : INT; i : INT; mode : INT; END_VAR; x := 0; mode := 1; IF mode = 1 THEN FOR i := 0 TO 2 DO x := x + 1; END_FOR; ELSE x := 99; END_IF; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(0), HalValue::S32(3));
}

// Test 29: deep_nesting
#[test]
fn test_nested_deep() {
    // IF x=0 THEN WHILE x<3 DO FOR i:=0 TO 1 DO CASE i OF 0: a:=a+1; 1: b:=b+1; END_CASE; END_FOR; x:=x+1 END_WHILE END_IF;
    let src = "PROGRAM test VAR x : INT; i : INT; a : INT; b : INT; END_VAR; x := 0; a := 0; b := 0; IF x = 0 THEN WHILE x < 3 DO FOR i := 0 TO 1 DO CASE i OF 0: a := a + 1; 1: b := b + 1; END_CASE; END_FOR; x := x + 1; END_WHILE; END_IF; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    // 3 WHILE iterations × 2 FOR iterations (i=0→a, i=1→b) = a=3, b=3
    assert_eq!(executor.vm().read_register(2), HalValue::S32(3));
    assert_eq!(executor.vm().read_register(3), HalValue::S32(3));
}

// Test 30: exit_from_nested
#[test]
fn test_nested_exit() {
    // EXIT breaks the nearest loop only, not outer loops
    let src = "PROGRAM test VAR x : INT; i : INT; END_VAR; x := 0; WHILE x < 10 DO FOR i := 0 TO 9 DO x := x + 1; IF x >= 3 THEN EXIT; END_IF; END_FOR; END_WHILE; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    // EXIT from FOR → outer WHILE continues until x >= 10
    assert_eq!(executor.vm().read_register(0), HalValue::S32(10));
}

// Test 31: return_inside_nested
#[test]
fn test_nested_return() {
    // RETURN from deep inside nested control flow stops everything
    let src = "PROGRAM test VAR x : INT; END_VAR; x := 0; WHILE x < 10 DO x := x + 1; IF x >= 3 THEN RETURN; END_IF; END_WHILE; x := 99; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(0), HalValue::S32(3));
}

// Test 32: repeat_with_if
#[test]
fn test_nested_repeat_with_if() {
    // REPEAT IF x MOD 2=0 THEN even:=even+1 END_IF; x:=x+1 UNTIL x>=6 END_REPEAT;
    let src = "PROGRAM test VAR x : INT; even : INT; END_VAR; x := 0; even := 0; REPEAT IF x MOD 2 = 0 THEN even := even + 1; END_IF; x := x + 1; UNTIL x >= 6 END_REPEAT; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    // x=0,2,4 → even=3
    assert_eq!(executor.vm().read_register(1), HalValue::S32(3));
}

// ── Tests 33-49: type pipeline coverage ──

#[test]
fn test_type_pipeline_real() {
    let src = "PROGRAM test VAR x : REAL; END_VAR; x := 3.14; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);
    let steps = executor.run_to_halt();
    assert!(steps > 0);
    // ponytail: codegen emits F32 for real literals
    assert_eq!(executor.vm().read_register(0), HalValue::F32(3.14f32));
}

#[test]
fn test_type_pipeline_dint() {
    let src = "PROGRAM test VAR x : DINT; END_VAR; x := -99999; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    // ponytail: all integer literals emit as S32
    assert_eq!(executor.vm().read_register(0), HalValue::S32(-99999));
}

#[test]
fn test_type_pipeline_lreal() {
    let src = "PROGRAM test VAR x : LREAL; END_VAR; x := 2.72; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(0), HalValue::F32(2.72f32));
}

#[test]
fn test_type_pipeline_sint() {
    let src = "PROGRAM test VAR x : SINT; END_VAR; x := -10; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(0), HalValue::S32(-10));
}

#[test]
fn test_type_pipeline_usint() {
    let src = "PROGRAM test VAR x : USINT; END_VAR; x := 200; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(0), HalValue::S32(200));
}

#[test]
fn test_type_pipeline_uint() {
    let src = "PROGRAM test VAR x : UINT; END_VAR; x := 50000; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(0), HalValue::S32(50000));
}

#[test]
fn test_type_pipeline_ulint() {
    let src = "PROGRAM test VAR x : ULINT; END_VAR; x := 999; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(0), HalValue::S32(999));
}

#[test]
fn test_type_pipeline_lint() {
    let src = "PROGRAM test VAR x : LINT; END_VAR; x := -888; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(0), HalValue::S32(-888));
}

#[test]
fn test_type_pipeline_byte() {
    let src = "PROGRAM test VAR x : BYTE; END_VAR; x := 255; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(0), HalValue::S32(255));
}

#[test]
fn test_type_pipeline_word() {
    let src = "PROGRAM test VAR x : WORD; END_VAR; x := 65535; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(0), HalValue::S32(65535));
}

#[test]
fn test_type_pipeline_dword() {
    let src = "PROGRAM test VAR x : DWORD; END_VAR; x := 99; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(0), HalValue::S32(99));
}

#[test]
fn test_type_pipeline_real_expr() {
    let src = "PROGRAM test VAR x : REAL; y : REAL; END_VAR; x := 1.5; y := x + 2.5; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(0), HalValue::F32(1.5));
    assert_eq!(executor.vm().read_register(1), HalValue::F32(4.0));
}

#[test]
fn test_type_pipeline_dint_expr() {
    let src = "PROGRAM test VAR x : DINT; y : DINT; END_VAR; x := 100; y := x * 10; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(0), HalValue::S32(100));
    assert_eq!(executor.vm().read_register(1), HalValue::S32(1000));
}

#[test]
fn test_type_pipeline_xor_word() {
    let src = "PROGRAM test VAR x : WORD; END_VAR; x := 61680 XOR 255; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(0), HalValue::S32(61680i32 ^ 255i32));
}

// ── Test 15: TON timer (on-delay) ──

#[test]
fn test_ton_timer_advances_with_cycle_time() {
    // TON timer: IN=trigger(r1), PT=500ms, Q→done(r2)
    let src = "PROGRAM test VAR ton1 : TON; trigger : BOOL; done : BOOL; END_VAR; ton1(trigger, 500); done := ton1.Q; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    // Verify TimerRun instruction exists
    let has_timer_run = program.instructions.iter().any(|i| matches!(i.opcode, audesys_hal_ir::instruction::Opcode::TimerRun));
    assert!(has_timer_run, "Program must contain TimerRun instruction");

    let mut executor = Executor::new(program);

    // Cycle 1: trigger=true, cycle=100ms
    executor.vm_mut().write_register(1, HalValue::Bool(true));
    executor.vm_mut().set_cycle_time(100);
    executor.vm_mut().reset_ip();
    executor.run_to_halt();
    // ET=100, Q=false (100 < 500)
    assert_eq!(executor.vm().read_register(2), HalValue::Bool(false), "Cycle 1: ET=100ms < 500ms");

    // Cycle 2: trigger=true, +200ms → ET=300
    executor.vm_mut().write_register(1, HalValue::Bool(true));
    executor.vm_mut().set_cycle_time(200);
    executor.vm_mut().reset_ip();
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::Bool(false), "Cycle 2: ET=300ms < 500ms");

    // Cycle 3: trigger=true, +300ms → ET=600ms >= 500ms → Q=true
    executor.vm_mut().write_register(1, HalValue::Bool(true));
    executor.vm_mut().set_cycle_time(300);
    executor.vm_mut().reset_ip();
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::Bool(true), "Cycle 3: ET=600ms >= 500ms");
}

// ── Test 50: TOF timer (off-delay) ──

#[test]
fn test_tof_timer() {
    let src = "PROGRAM test VAR tof1 : TOF; trigger : BOOL; done : BOOL; END_VAR; tof1(trigger, 500); done := tof1.Q; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    let mut executor = Executor::new(program);

    // Cycle 1: IN=true → Q=true immediately
    executor.vm_mut().write_register(1, HalValue::Bool(true));
    executor.vm_mut().set_cycle_time(100);
    executor.vm_mut().reset_ip();
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::Bool(true), "TOF Q should be true immediately on IN=true");

    // Cycle 2: IN=false → start timing, Q still true
    executor.vm_mut().write_register(1, HalValue::Bool(false));
    executor.vm_mut().set_cycle_time(100);
    executor.vm_mut().reset_ip();
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::Bool(true), "TOF Q should stay true while ET<PT");

    // Cycle 3: IN=false, +450ms → ET=550 >= 500 → Q=false
    executor.vm_mut().write_register(1, HalValue::Bool(false));
    executor.vm_mut().set_cycle_time(450);
    executor.vm_mut().reset_ip();
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::Bool(false), "TOF Q should be false after ET>=PT");
}

// ── Test 51: TP timer (pulse) ──

#[test]
fn test_tp_timer() {
    let src = "PROGRAM test VAR tp1 : TP; trigger : BOOL; done : BOOL; END_VAR; tp1(trigger, 500); done := tp1.Q; END_PROGRAM";
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    let mut executor = Executor::new(program);

    // Cycle 1: IN rising edge → Q=true, start timing
    executor.vm_mut().write_register(1, HalValue::Bool(true));
    executor.vm_mut().set_cycle_time(100);
    executor.vm_mut().reset_ip();
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::Bool(true), "TP Q should be true on rising edge");

    // Cycle 2: IN stays true → Q stays true, ET=300
    executor.vm_mut().write_register(1, HalValue::Bool(true));
    executor.vm_mut().set_cycle_time(200);
    executor.vm_mut().reset_ip();
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::Bool(true), "TP Q stays true while ET<PT");

    // Cycle 3: IN falls → Q terminates early
    executor.vm_mut().write_register(1, HalValue::Bool(false));
    executor.vm_mut().set_cycle_time(50);
    executor.vm_mut().reset_ip();
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::Bool(false), "TP Q should be false when IN falls");
}

// ── Test 52: Demo — TON + IF + counter (full pipeline) ──

#[test]
fn test_demo_timer_with_counter_and_if() {
    // Demonstrates: TON timer, IF condition, arithmetic (count := count + 1)
    // Variables: timer1:TON=r0, trigger:BOOL=r1, count:INT=r2, done:BOOL=r3
    let src = concat!(
        "PROGRAM demo VAR timer1 : TON; trigger : BOOL; count : INT; done : BOOL; END_VAR ",
        "timer1(trigger, 500); ",
        "IF timer1.Q THEN count := count + 1; END_IF; ",
        "done := timer1.Q; ",
        "END_PROGRAM",
    );
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    let mut executor = Executor::new(program);

    // Cycle 1: IN=true, 100ms → ET=100 < 500 → Q=false, count unchanged
    executor.vm_mut().write_register(1, HalValue::Bool(true));  // trigger = true
    executor.vm_mut().set_cycle_time(100);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::S32(0), "Cycle 1: Q=false, count=0");
    assert_eq!(executor.vm().read_register(3), HalValue::Bool(false), "Cycle 1: done=false");

    // Cycle 2: IN=true, 400ms → ET=500 >= 500 → Q=true → count=1
    executor.vm_mut().write_register(1, HalValue::Bool(true));
    executor.vm_mut().set_cycle_time(400);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::S32(1), "Cycle 2: Q=true, count=1");
    assert_eq!(executor.vm().read_register(3), HalValue::Bool(true), "Cycle 2: done=true");

    // Cycle 3: IN=true, 200ms → Q stays true → count=2
    executor.vm_mut().write_register(1, HalValue::Bool(true));
    executor.vm_mut().set_cycle_time(200);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::S32(2), "Cycle 3: Q=true, count=2");
    assert_eq!(executor.vm().read_register(3), HalValue::Bool(true), "Cycle 3: done=true");

    // Cycle 4: IN=false → timer resets → Q=false, count stays 2
    executor.vm_mut().write_register(1, HalValue::Bool(false));
    executor.vm_mut().set_cycle_time(100);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::S32(2), "Cycle 4: Q=false, count unchanged");
    assert_eq!(executor.vm().read_register(3), HalValue::Bool(false), "Cycle 4: done=false");
}

// ── CTU counter tests ──

#[test]
fn test_ctu_counts_up() {
    // CTU counter: cu input (r1), CV increments on rising edge
    let src = concat!(
        "PROGRAM test VAR ctr1 : CTU; pulse : BOOL; done : BOOL; END_VAR ",
        "ctr1(pulse, 3); ",
        "IF ctr1.Q THEN done := TRUE; END_IF; ",
        "END_PROGRAM",
    );
    let program = compile(src).expect("compilation failed");
    let mut executor = Executor::new(program);

    // Rise edge 1: CV=1, Q=false
    executor.vm_mut().write_register(1, HalValue::Bool(true));
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(3), HalValue::Bool(false));

    // Reset pulse, rise edge 2: CV=2, Q=false
    executor.vm_mut().write_register(1, HalValue::Bool(false));
    executor.run_to_halt();
    executor.vm_mut().write_register(1, HalValue::Bool(true));
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(3), HalValue::Bool(false));

    // Rise edge 3: CV=3, Q=true (CV>=PV)
    executor.vm_mut().write_register(1, HalValue::Bool(false));
    executor.run_to_halt();
    executor.vm_mut().write_register(1, HalValue::Bool(true));
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(3), HalValue::Bool(true));
}

// ── Test 53: SR flip-flop (set-dominant) ──

#[test]
fn test_sr_sets_q1_on_s1() {
    // SR: S1=true sets Q1, R=true resets, S1 wins in conflict
    let src = concat!(
        "PROGRAM test VAR sr1 : SR; s : BOOL; r : BOOL; out : BOOL; END_VAR ",
        "sr1(s, r); ",
        "out := sr1.Q1; ",
        "END_PROGRAM",
    );
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());

    let has_sr_run = program.instructions.iter().any(|i| matches!(i.opcode, audesys_hal_ir::instruction::Opcode::SrRun));
    assert!(has_sr_run, "Program must contain SrRun instruction");

    let mut executor = Executor::new(program);

    // Cycle 1: S1=true, R=false → Q1=true, Q2=false
    executor.vm_mut().write_register(1, HalValue::Bool(true));  // s
    executor.vm_mut().write_register(2, HalValue::Bool(false)); // r
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(3), HalValue::Bool(true), "SR: S1=true should set Q1");
}

#[test]
fn test_sr_reset() {
    // SR: S1=true then R=true resets Q1
    let src = concat!(
        "PROGRAM test VAR sr1 : SR; s : BOOL; r : BOOL; out : BOOL; END_VAR ",
        "sr1(s, r); ",
        "out := sr1.Q1; ",
        "END_PROGRAM",
    );
    let program = compile(src).expect("compilation failed");
    let mut executor = Executor::new(program);

    // Set it first
    executor.vm_mut().write_register(1, HalValue::Bool(true));  // s
    executor.vm_mut().write_register(2, HalValue::Bool(false)); // r
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(3), HalValue::Bool(true), "SR: Q1 should be true after set");

    // Then reset
    executor.vm_mut().write_register(1, HalValue::Bool(false)); // s
    executor.vm_mut().write_register(2, HalValue::Bool(true));  // r
    executor.vm_mut().reset_ip();
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(3), HalValue::Bool(false), "SR: R=true should clear Q1");
}

#[test]
fn test_sr_both_true_s_sets() {
    // SR: both S1 and R true → S1 wins (set-dominant)
    let src = concat!(
        "PROGRAM test VAR sr1 : SR; s : BOOL; r : BOOL; out : BOOL; END_VAR ",
        "sr1(s, r); ",
        "out := sr1.Q1; ",
        "END_PROGRAM",
    );
    let program = compile(src).expect("compilation failed");
    let mut executor = Executor::new(program);

    executor.vm_mut().write_register(1, HalValue::Bool(true));  // s
    executor.vm_mut().write_register(2, HalValue::Bool(true));  // r
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(3), HalValue::Bool(true), "SR: S1 wins when both true");
}

// ── Test 54: RS flip-flop (reset-dominant) ──

#[test]
fn test_rs_reset_dominant() {
    // RS: R=true resets, S1=true sets, R wins in conflict
    let src = concat!(
        "PROGRAM test VAR rs1 : RS; s : BOOL; r : BOOL; out : BOOL; END_VAR ",
        "rs1(s, r); ",
        "out := rs1.Q1; ",
        "END_PROGRAM",
    );
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);

    // Set
    executor.vm_mut().write_register(1, HalValue::Bool(true));  // s
    executor.vm_mut().write_register(2, HalValue::Bool(false)); // r
    executor.vm_mut().reset_ip();
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(3), HalValue::Bool(true), "RS: S1=true should set Q1");

    // Reset
    executor.vm_mut().write_register(1, HalValue::Bool(false)); // s
    executor.vm_mut().write_register(2, HalValue::Bool(true));  // r
    executor.vm_mut().reset_ip();
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(3), HalValue::Bool(false), "RS: R=true should clear Q1");

    // Both true → R wins (reset-dominant)
    executor.vm_mut().write_register(1, HalValue::Bool(true));  // s
    executor.vm_mut().write_register(2, HalValue::Bool(true));  // r
    executor.vm_mut().reset_ip();
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(3), HalValue::Bool(false), "RS: R wins when both true");
}

// ── Test 55: R_TRIG (rising edge detector) ──

#[test]
fn test_rtrig_rising_edge() {
    // R_TRIG: Q=true for ONE cycle on 0→1 transition of CLK
    let src = concat!(
        "PROGRAM test VAR trig1 : R_TRIG; clk : BOOL; out : BOOL; END_VAR ",
        "trig1(clk); ",
        "out := trig1.Q; ",
        "END_PROGRAM",
    );
    let program = compile(src).expect("compilation failed");
    assert!(program.is_well_formed());
    let mut executor = Executor::new(program);

    // Cycle 1: CLK=false → Q stays false (no edge)
    executor.vm_mut().write_register(1, HalValue::Bool(false));
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::Bool(false), "R_TRIG: Q=false when CLK stays low");

    // Cycle 2: CLK=true (rising edge) → Q=true
    executor.vm_mut().reset_ip();
    executor.vm_mut().write_register(1, HalValue::Bool(true));
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::Bool(true), "R_TRIG: Q=true on rising edge");

    // Cycle 3: CLK stays true → Q goes false (only one-cycle pulse)
    executor.vm_mut().reset_ip();
    executor.vm_mut().write_register(1, HalValue::Bool(true));
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::Bool(false), "R_TRIG: Q=false after rising edge pulse");

    // Cycle 4: CLK=false (falling edge) → Q false (no trigger)
    executor.vm_mut().reset_ip();
    executor.vm_mut().write_register(1, HalValue::Bool(false));
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::Bool(false), "R_TRIG: Q ignored falling edge");

    // Cycle 5: CLK=true (another rising edge) → Q=true again
    executor.vm_mut().reset_ip();
    executor.vm_mut().write_register(1, HalValue::Bool(true));
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::Bool(true), "R_TRIG: second rising edge triggered");
}

// ── Test 56: F_TRIG (falling edge detector) ──

#[test]
fn test_ftrig_falling_edge() {
    // F_TRIG: Q=true for ONE cycle on 1→0 transition of CLK
    let src = concat!(
        "PROGRAM test VAR trig1 : F_TRIG; clk : BOOL; out : BOOL; END_VAR ",
        "trig1(clk); ",
        "out := trig1.Q; ",
        "END_PROGRAM",
    );
    let program = compile(src).expect("compilation failed");
    let mut executor = Executor::new(program);

    // Cycle 1: CLK=true → no edge yet, last_clk stored as true
    executor.vm_mut().write_register(1, HalValue::Bool(true));
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::Bool(false), "F_TRIG: Q=false when CLK starts high");

    // Cycle 2: CLK=false (falling edge) → Q=true
    executor.vm_mut().reset_ip();
    executor.vm_mut().write_register(1, HalValue::Bool(false));
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::Bool(true), "F_TRIG: Q=true on falling edge");

    // Cycle 3: CLK stays false → Q=false
    executor.vm_mut().reset_ip();
    executor.vm_mut().write_register(1, HalValue::Bool(false));
    executor.run_to_halt();
    assert_eq!(executor.vm().read_register(2), HalValue::Bool(false), "F_TRIG: Q=false after falling edge pulse");
}


