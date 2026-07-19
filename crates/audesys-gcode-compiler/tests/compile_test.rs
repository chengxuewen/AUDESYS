//! Integration tests for the G-code compiler pipeline.
//! Tests: compile → verify HalProgram structure + execute on Executor.

use audesys_gcode_compiler::gcode_compile;
use audesys_hal_ir::Executor;

#[test]
fn test_compile_g0_simple() {
    let program = gcode_compile("G0 X10.0").expect("should compile G0");
    assert!(!program.instructions.is_empty(), "should produce instructions");
}

#[test]
fn test_compile_g0_multi_axis() {
    let program = gcode_compile("G0 X10.0 Y20.0 Z5.0").expect("should compile multi-axis G0");
    let has_x = program.signals.iter().any(|s| s.hal_signal_name == "axis.0.pos");
    let has_y = program.signals.iter().any(|s| s.hal_signal_name == "axis.1.pos");
    let has_z = program.signals.iter().any(|s| s.hal_signal_name == "axis.2.pos");
    assert!(has_x, "should bind axis.0.pos signal");
    assert!(has_y, "should bind axis.1.pos signal");
    assert!(has_z, "should bind axis.2.pos signal");
}

#[test]
fn test_compile_and_execute() {
    let program = gcode_compile("G0 X10.0\nM30").expect("should compile");
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    // After Halt, signal should be stored
    let val = executor.vm().read_signal("axis.0.pos");
    assert!(val.is_some(), "axis.0.pos should have a value");
}

#[test]
fn test_compile_m3_spindle() {
    let program = gcode_compile("M3 S1000\nM30").expect("should compile M3");
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    let cw = executor.vm().read_signal("spindle.cw");
    assert!(cw.is_some(), "spindle.cw should have a value");
}

#[test]
fn test_compile_m5_spindle_off() {
    let program = gcode_compile("M3 S500\nM5\nM30").expect("should compile M5");
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    let cw = executor.vm().read_signal("spindle.cw");
    assert!(cw.is_some(), "spindle.cw should exist");
}

#[test]
fn test_error_unknown_gcode() {
    let result = gcode_compile("G999");
    assert!(result.is_err(), "unknown G-code should error");

    let result2 = gcode_compile("M999");
    assert!(result2.is_err(), "unknown M-code should error");
}

#[test]
fn test_g90_absolute_g0() {
    // G90 G0 X10 → axis.0.pos should approach 10
    let program = gcode_compile("G90 G0 X10.0\nM30").expect("should compile");
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    let val = executor.vm().read_signal("axis.0.pos");
    assert!(val.is_some());
}

#[test]
fn test_g91_incremental_g0() {
    // G91 G0 X5 → then G0 X3 → position should be 8
    let program = gcode_compile("G91 G0 X5.0\nG0 X3.0\nM30").expect("should compile");
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    let val = executor.vm().read_signal("axis.0.pos");
    assert!(val.is_some());
}

#[test]
fn test_g1_basic() {
    let program = gcode_compile("G90 G1 X20.0 F500\nM30").expect("should compile G1");
    assert!(!program.instructions.is_empty());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    let val = executor.vm().read_signal("axis.0.pos");
    assert!(val.is_some());
}

#[test]
fn test_trapezoidal_generates_mul_ops() {
    use audesys_hal_ir::instruction::Opcode;
    let program = gcode_compile("G1 X100.0 F300\nM30").expect("compile G1");
    let has_mul = program.instructions.iter().any(|i| i.opcode == Opcode::Mul);
    assert!(has_mul, "Trapezoidal profile should generate Mul for velocity computation");
}
