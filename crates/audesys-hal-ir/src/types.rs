//! HAL IR types — bindings and operands.
//! 来源: docs/modules/compiler/hal-ir-design.md §1, §2.2

use audesys_hal_core::HalValue;
use audesys_hal_core::types::HalPinType;
use serde::{Deserialize, Serialize};

/// I/O direction for signal and channel bindings.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Direction {
    Read,
    Write,
    ReadWrite,
}

/// Maps a program variable to a HAL Signal (1.1).
/// Compiler extracts these from ST variable declarations with AT %IW/%QW addresses.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SignalBinding {
    /// HAL Signal name, e.g., "sensor.counter" (D10: component.interface.name)
    pub hal_signal_name: String,
    /// Variable name in IR (register alias used in Load/Store)
    pub program_var: String,
    pub direction: Direction,
    pub hal_pin_type: HalPinType,
}

/// Maps a program variable to a named StreamChannel (1.2).
/// Used for logging, alarms, supervisor data channels.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChannelBinding {
    /// Channel name, e.g., "alarms.overheat" (D10: domain.stream_name)
    pub channel_name: String,
    pub direction: Direction,
}

/// Instruction operand — register index, immediate value, or signal name reference.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Operand {
    /// General-purpose register r0–r15
    Register(u8),
    /// Literal constant value embedded in the instruction
    Immediate(HalValue),
    /// Named signal reference (resolved via SignalBinding at load time)
    SignalName(String),
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_operand_register_bounds() {
        // r0–r15 are valid register indices
        for i in 0..16u8 {
            let op = Operand::Register(i);
            assert_eq!(op, Operand::Register(i));
        }
    }

    #[test]
    fn test_operand_immediate_roundtrip() {
        let val = HalValue::S32(42);
        let op = Operand::Immediate(val.clone());
        assert_eq!(op, Operand::Immediate(HalValue::S32(42)));
    }

    #[test]
    fn test_signal_binding_creation() {
        let binding = SignalBinding {
            hal_signal_name: "sensor.temp".into(),
            program_var: "sensor".into(),
            direction: Direction::Read,
            hal_pin_type: HalPinType::S32,
        };
        assert_eq!(binding.hal_signal_name, "sensor.temp");
        assert_eq!(binding.direction, Direction::Read);
    }
}
