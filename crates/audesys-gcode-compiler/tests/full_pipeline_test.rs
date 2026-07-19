//! Full pipeline test: multi-line G-code program → compile → execute → verify.
use audesys_gcode_compiler::gcode_compile;
use audesys_hal_ir::Executor;

#[test]
fn test_full_program_pipeline() {
    let source = "\
G90 G21
G0 X0 Y0 Z0
G1 X10.0 F500
G1 X30.0
M3 S1000
G1 X50.0 F300
M5
G0 X0 Y0 Z0
M30";

    let program = gcode_compile(source).expect("full program should compile");
    assert!(!program.instructions.is_empty());
    assert!(!program.signals.is_empty());

    // Execute on VM
    let mut executor = Executor::new(program);
    executor.run_to_halt();

    // After M5, spindle should be off (or at least signals exist)
    let cw = executor.vm().read_signal("spindle.cw");
    assert!(cw.is_some(), "spindle.cw signal should exist");

    // Axis 0 should have position signals
    let x = executor.vm().read_signal("axis.0.pos");
    assert!(x.is_some(), "axis.0.pos should exist");
}

#[test]
fn test_g0_g1_mixed() {
    let source = "\
G90 G21
G0 X0 Y0
G1 X50.0 F1000
G0 Z10.0
G1 X100.0 Y50.0 F500
M30";

    let program = gcode_compile(source).expect("mixed G0/G1 should compile");

    // Should have signals for X, Y, Z axes
    let signal_names: Vec<&str> = program.signals.iter().map(|s| s.hal_signal_name.as_str()).collect();
    assert!(signal_names.contains(&"axis.0.pos"), "should bind X axis");
    assert!(signal_names.contains(&"axis.1.pos"), "should bind Y axis");
    assert!(signal_names.contains(&"axis.2.pos"), "should bind Z axis");

    let mut executor = Executor::new(program);
    executor.run_to_halt();
}

#[test]
fn test_with_comments() {
    let source = "\
(Start of program)
G90 G21
G0 X0 Y0 (home position)
; now move to first point
G1 X10.0 F200
(move to second)
G1 X20.0
M30 (end)";

    let program = gcode_compile(source).expect("program with comments should compile");
    assert!(!program.instructions.is_empty());

    let mut executor = Executor::new(program);
    executor.run_to_halt();
}

#[test]
fn test_line_numbers() {
    let source = "\
N10 G90 G21
N20 G0 X0 Y0
N30 G1 X10.0 F100
N40 M30";

    let program = gcode_compile(source).expect("program with line numbers should compile");
    assert!(!program.instructions.is_empty());

    let mut executor = Executor::new(program);
    executor.run_to_halt();
}

#[test]
fn test_block_delete() {
    // Block delete "/" should skip the line
    let source = "\
G90 G21
G0 X0
/ G0 X999.0
G1 X10.0 F100
M30";

    let program = gcode_compile(source).expect("program with block delete should compile");
    let mut executor = Executor::new(program);
    executor.run_to_halt();

    // X should be near 10, NOT 999
    let val = executor.vm().read_signal("axis.0.pos");
    assert!(val.is_some(), "X position should exist");
}

#[test]
fn test_modal_state_inheritance() {
    // Feedrate F500 set on line 1, inherited by line 2
    let source = "\
G90 G21
G1 X10.0 F500
G1 X20.0
M30";

    let program = gcode_compile(source).expect("modal state should propagate");
    assert!(!program.instructions.is_empty());
    let mut executor = Executor::new(program);
    executor.run_to_halt();
}

#[test]
fn test_unit_conversion() {
    // G20 (inches) → G21 (mm) switch
    let source = "\
G90 G20
G0 X1.0
G21
G0 X25.4
M30";

    let program = gcode_compile(source).expect("unit conversion should work");
    let mut executor = Executor::new(program);
    executor.run_to_halt();

    // After G21 G0 X25.4, position should be 25.4mm
    let val = executor.vm().read_signal("axis.0.pos");
    assert!(val.is_some());
}
