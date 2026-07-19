//! AUDESYS CNC Axis Group — homing, soft limits, backlash, alarm management.
//!
//! Generates HalProgram instructions that execute within the Engine's VM cycle.
//! Phase 1 scope: single axis group, 3 linear axes (X/Y/Z), sequential homing,
//! trivial kinematics.
//!
//! # Architecture
//! - `config`: AxisGroupConfig, AxisConfig structs
//! - `homing`: SEEK→LATCH→BACKOFF→DONE state machine
//! - `limits`: Soft limit enforcement with clamping
//! - `backlash`: Direction-reversal compensation
//! - `alarm`: Fault aggregation and alarm state

pub mod alarm;
pub mod backlash;
pub mod config;
pub mod homing;
pub mod limits;

// Re-exports
pub use alarm::generate_alarm_program;
pub use alarm::{ALARM_ALARM, ALARM_ESTOP, ALARM_NORMAL, ALARM_WARNING};
pub use backlash::generate_backlash_program;
pub use config::{AxisConfig, AxisGroupConfig, AxisType, HomeDirection, Plane};
pub use homing::generate_homing_program;
pub use limits::generate_soft_limits_program;

use audesys_hal_ir::program::HalProgram;

/// Generate a combined HalProgram that runs all axis group checks in sequence:
/// homing → soft limits → backlash → alarm.
///
/// This is the entry point for loading into the Engine's VM executor.
pub fn generate_combined_program(cfg: &AxisGroupConfig) -> HalProgram {
    let homing = generate_homing_program(cfg);
    let limits = generate_soft_limits_program(cfg);
    let backlash = generate_backlash_program(cfg);
    let alarm = generate_alarm_program(cfg);

    let mut instructions: Vec<audesys_hal_ir::instruction::Instruction> = Vec::new();

    // Merge all instructions, removing Halt terminators from intermediate programs
    for (_i, prog) in [&homing, &limits, &backlash, &alarm].iter().enumerate() {
        for inst in &prog.instructions {
            if inst.opcode == audesys_hal_ir::instruction::Opcode::Halt {
                continue; // skip intermediate halts
            }
            instructions.push(inst.clone());
        }
    }

    // Add single Halt at end
    instructions.push(audesys_hal_ir::instruction::Instruction::halt());

    // Merge signal bindings (dedup by hal_signal_name)
    let mut signals = homing.signals.clone();
    for prog in &[&limits, &backlash, &alarm] {
        for s in &prog.signals {
            if !signals.iter().any(|existing| existing.hal_signal_name == s.hal_signal_name) {
                signals.push(s.clone());
            }
        }
    }

    HalProgram {
        name: format!("axis_group_{}", cfg.name),
        instructions,
        signals,
        channels: vec![],
        function_table: vec![],
    }
}

// ── Integration Tests ──

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_three_axis_config_default() {
        let cfg = AxisGroupConfig::default_xyz();
        assert_eq!(cfg.axis_count(), 3);
        assert_eq!(cfg.axes[0].label, "X");
        assert_eq!(cfg.axes[1].label, "Y");
        assert_eq!(cfg.axes[2].label, "Z");
        assert_eq!(cfg.axes[0].index, 0);
        assert_eq!(cfg.axes[1].index, 1);
        assert_eq!(cfg.axes[2].index, 2);
        assert!(cfg.axes[0].soft_limit_enable);
        assert!(!cfg.axes[0].backlash_enable);
    }

    #[test]
    fn test_homing_program_generated() {
        let cfg = AxisGroupConfig::default_xyz();
        let prog = generate_homing_program(&cfg);
        assert!(!prog.instructions.is_empty());
        assert!(prog.instructions.len() > 5, "homing program should have multiple instructions");
        assert!(
            prog.signals.iter().any(|s| s.hal_signal_name.ends_with(".homed")),
            "should have homed signals"
        );
        assert!(
            prog.signals.iter().any(|s| s.hal_signal_name.ends_with(".vel_cmd")),
            "should have vel_cmd signals"
        );
    }

    #[test]
    fn test_soft_limits_program_generated() {
        let cfg = AxisGroupConfig::default_xyz();
        let prog = generate_soft_limits_program(&cfg);
        assert!(!prog.instructions.is_empty());
        assert!(prog.instructions.len() > 3, "soft limits should have multiple instructions");
        assert!(
            prog.signals.iter().any(|s| s.hal_signal_name.ends_with(".pos_fault")),
            "should have per-axis pos_fault signals"
        );
    }

    #[test]
    fn test_alarm_state_aggregation() {
        let cfg = AxisGroupConfig::default_xyz();
        let prog = generate_alarm_program(&cfg);

        // Verify that any_fault signal is written
        let any_fault_signal = prog
            .signals
            .iter()
            .find(|s| s.hal_signal_name == "group.0.any_fault");
        assert!(any_fault_signal.is_some(), "should have any_fault signal");
        assert_eq!(
            any_fault_signal.unwrap().direction,
            audesys_hal_ir::types::Direction::Write
        );

        // alarm_state should be ReadWrite
        let alarm_signal = prog
            .signals
            .iter()
            .find(|s| s.hal_signal_name == "group.0.alarm_state");
        assert!(alarm_signal.is_some(), "should have alarm_state signal");

        // Verify program structure: constants + fault checks + state compute + halt
        assert!(
            prog.instructions.len() > 10,
            "alarm program should have instructions for all 3 axes"
        );
        assert_eq!(
            prog.instructions.last().unwrap().opcode,
            audesys_hal_ir::instruction::Opcode::Halt
        );
    }

    #[test]
    fn test_signal_bindings_complete() {
        let cfg = AxisGroupConfig::default_xyz();
        let prog = generate_combined_program(&cfg);

        let expected_signals = [
            "group.group.0.axis.0.homing_state",
            "group.group.0.axis.0.pos_cmd",
            "group.group.0.axis.0.vel_cmd",
            "group.group.0.axis.0.enable",
            "group.group.0.axis.0.limit_pos",
            "group.group.0.axis.0.limit_neg",
            "group.group.0.axis.0.homed",
            "group.group.0.axis.0.pos_fault",
            "group.group.0.axis.0.vel_fault",
            "group.group.0.axis.1.homing_state",
            "group.group.0.axis.1.pos_cmd",
            "group.group.0.axis.1.vel_cmd",
            "group.group.0.axis.1.enable",
            "group.group.0.axis.1.limit_pos",
            "group.group.0.axis.1.limit_neg",
            "group.group.0.axis.1.homed",
            "group.group.0.axis.1.pos_fault",
            "group.group.0.axis.1.vel_fault",
            "group.group.0.axis.2.homing_state",
            "group.group.0.axis.2.pos_cmd",
            "group.group.0.axis.2.vel_cmd",
            "group.group.0.axis.2.enable",
            "group.group.0.axis.2.limit_pos",
            "group.group.0.axis.2.limit_neg",
            "group.group.0.axis.2.homed",
            "group.group.0.axis.2.pos_fault",
            "group.group.0.axis.2.vel_fault",
            "group.0.alarm_state",
            "group.0.any_fault",
        ];

        let signal_names: Vec<&str> = prog.signals.iter().map(|s| s.hal_signal_name.as_str()).collect();

        for expected in &expected_signals {
            assert!(
                signal_names.contains(expected),
                "missing expected signal: {}",
                expected
            );
        }
    }

    #[test]
    fn test_combined_program_ends_with_halt() {
        let cfg = AxisGroupConfig::default_xyz();
        let prog = generate_combined_program(&cfg);
        assert_eq!(
            prog.instructions.last().unwrap().opcode,
            audesys_hal_ir::instruction::Opcode::Halt
        );
    }

    #[test]
    fn test_combined_program_no_duplicate_halt() {
        let cfg = AxisGroupConfig::default_xyz();
        let prog = generate_combined_program(&cfg);
        let halt_count = prog
            .instructions
            .iter()
            .filter(|i| i.opcode == audesys_hal_ir::instruction::Opcode::Halt)
            .count();
        assert_eq!(halt_count, 1, "combined program should have exactly one Halt");
    }
}
