//! HalProgram — compiled IR program structure.
//! 来源: docs/modules/compiler/hal-ir-design.md §1, §2.1

use crate::instruction::Instruction;
use crate::types::{ChannelBinding, SignalBinding};
use serde::{Deserialize, Serialize};

/// Entry point for a user-defined function in the instruction stream.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FunctionEntry {
    /// Function name from ST source
    pub name: String,
    /// Instruction index where this function's body starts
    pub entry_point: u32,
    /// Number of registers this function uses (params + locals)
    pub reg_count: u8,
}

/// A compiled IEC 61131-3 program in HAL IR format.
///
/// Contains signal/channel bindings (I/O mapping), an executable
/// instruction stream for the register VM, and a function table
/// for multi-function program support.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HalProgram {
    /// Program name from ST source
    pub name: String,
    /// Signal ⇄ variable bindings (I/O mapping)
    pub signals: Vec<SignalBinding>,
    /// StreamChannel bindings (logging, alarms, data channels)
    pub channels: Vec<ChannelBinding>,
    /// Executable instruction stream
    pub instructions: Vec<Instruction>,
    /// Function table: name → entry point mapping for Call resolution
    pub function_table: Vec<FunctionEntry>,
}

impl HalProgram {
    /// Create a new HalProgram with the given name and instruction stream.
    /// Signal and channel bindings default to empty.
    pub fn new(name: impl Into<String>, instructions: Vec<Instruction>) -> Self {
        HalProgram {
            name: name.into(),
            signals: vec![],
            channels: vec![],
            instructions,
            function_table: vec![],
        }
    }

    /// Return the number of instructions in this program.
    pub fn instruction_count(&self) -> usize {
        self.instructions.len()
    }

    /// Check if the program has a Halt instruction as its last instruction.
    /// Note: with multi-function programs, Halt marks the end of the main body.
    pub fn is_well_formed(&self) -> bool {
        self.instructions.iter().any(|inst| inst.opcode == crate::instruction::Opcode::Halt)
    }

    /// Add a function entry to the function table.
    pub fn add_function(&mut self, entry: FunctionEntry) {
        self.function_table.push(entry);
    }
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;
    use crate::instruction::Instruction;
    use crate::types::Direction;
    use crate::types::SignalBinding;

    use audesys_hal_core::HalValue;

    #[test]
    fn test_empty_program() {
        let program = HalProgram::new("empty", vec![]);
        assert_eq!(program.name, "empty");
        assert_eq!(program.instruction_count(), 0);
        assert!(program.signals.is_empty());
        assert!(program.channels.is_empty());
        assert!(program.function_table.is_empty());
    }

    #[test]
    fn test_program_with_instructions() {
        let instructions = vec![Instruction::load_imm(0, HalValue::S32(1)), Instruction::halt()];
        let program = HalProgram::new("test", instructions);
        assert_eq!(program.instruction_count(), 2);
        assert!(program.is_well_formed());
    }

    #[test]
    fn test_program_with_function_table() {
        let instructions = vec![
            Instruction::halt(),
            Instruction::load_imm(0, HalValue::S32(0)),
            Instruction::ret(None),
        ];
        let mut program = HalProgram::new("test", instructions);
        program.add_function(FunctionEntry { name: "init".into(), entry_point: 1, reg_count: 1 });
        assert_eq!(program.function_table.len(), 1);
        assert_eq!(program.function_table[0].name, "init");
        assert_eq!(program.function_table[0].entry_point, 1);
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
            hal_pin_type: audesys_hal_core::types::HalPinType::S32,
        });
        assert_eq!(program.signals.len(), 1);
        assert_eq!(program.signals[0].hal_signal_name, "sensor.temp");
    }

    #[test]
    fn test_halprogram_serde_roundtrip() {
        let prog = HalProgram::new(
            "test",
            vec![Instruction::load_imm(0, HalValue::S32(42)), Instruction::halt()],
        );
        let bytes = bincode::serialize(&prog).unwrap();
        let prog2: HalProgram = bincode::deserialize(&bytes).unwrap();
        assert_eq!(prog.name, prog2.name);
        assert_eq!(prog.instructions.len(), prog2.instructions.len());
    }
}
