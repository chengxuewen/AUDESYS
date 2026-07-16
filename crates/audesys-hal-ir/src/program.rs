//! HalProgram — compiled IR program structure.
//! 来源: docs/modules/compiler/hal-ir-design.md §1, §2.1

use crate::instruction::Instruction;
use crate::types::{ChannelBinding, SignalBinding};

/// A compiled IEC 61131-3 program in HAL IR format.
///
/// Contains signal/channel bindings (I/O mapping) and an executable
/// instruction stream for the register VM.
#[derive(Debug, Clone, PartialEq)]
pub struct HalProgram {
    /// Program name from ST source
    pub name: String,
    /// Signal ⇄ variable bindings (I/O mapping)
    pub signals: Vec<SignalBinding>,
    /// StreamChannel bindings (logging, alarms, data channels)
    pub channels: Vec<ChannelBinding>,
    /// Executable instruction stream
    pub instructions: Vec<Instruction>,
}

impl HalProgram {
    /// Create a new HalProgram with the given name and instruction stream.
    /// Signal and channel bindings default to empty.
    pub fn new(name: impl Into<String>, instructions: Vec<Instruction>) -> Self {
        HalProgram { name: name.into(), signals: vec![], channels: vec![], instructions }
    }

    /// Return the number of instructions in this program.
    pub fn instruction_count(&self) -> usize {
        self.instructions.len()
    }

    /// Check if the program has a Halt instruction as its last instruction.
    pub fn is_well_formed(&self) -> bool {
        self.instructions.last().is_some_and(|inst| inst.opcode == crate::instruction::Opcode::Halt)
    }
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;
    use crate::instruction::Instruction;
    use crate::types::SignalBinding;
    use crate::types::{Direction, Operand};
    use audesys_hal_core::HalValue;

    #[test]
    fn test_empty_program() {
        let program = HalProgram::new("empty", vec![]);
        assert_eq!(program.name, "empty");
        assert_eq!(program.instruction_count(), 0);
        assert!(program.signals.is_empty());
        assert!(program.channels.is_empty());
    }

    #[test]
    fn test_program_with_instructions() {
        let instructions = vec![Instruction::load_imm(0, HalValue::S32(1)), Instruction::halt()];
        let program = HalProgram::new("test", instructions);
        assert_eq!(program.instruction_count(), 2);
        assert!(program.is_well_formed());
    }

    #[test]
    fn test_is_well_formed_no_halt() {
        let program = HalProgram::new("bad", vec![Instruction::nop(), Instruction::nop()]);
        assert!(!program.is_well_formed());
    }

    #[test]
    fn test_program_with_signals() {
        let mut program = HalProgram::new("with_signals", vec![Instruction::halt()]);
        program.signals.push(SignalBinding {
            hal_signal_name: "sensor.temp".into(),
            program_var: "sensor".into(),
            direction: Direction::Read,
        });
        assert_eq!(program.signals.len(), 1);
        assert_eq!(program.signals[0].hal_signal_name, "sensor.temp");
    }
}
