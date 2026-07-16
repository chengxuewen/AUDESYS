//! HAL IR instruction set — 22 opcodes for Phase 1 ST programs.
//! 来源: docs/modules/compiler/hal-ir-design.md §2.4, §2.5

use crate::types::Operand;
use serde::{Deserialize, Serialize};

/// VM opcode — one byte to keep programs compact.
///
/// # Operand conventions (from design §2.5)
/// | Opcode | Operands | Semantic |
/// |--------|----------|----------|
/// | Load   | dest_reg, Immediate | r[dest] ← value |
/// | Store  | SignalName, src_reg | publish signal ← r[src] |
/// | Add    | reg_a, reg_b, reg_out | r[out] ← r[a] + r[b] |
/// | Sub    | reg_a, reg_b, reg_out | r[out] ← r[a] - r[b] |
/// | Mul    | reg_a, reg_b, reg_out | r[out] ← r[a] * r[b] |
/// | Div    | reg_a, reg_b, reg_out | r[out] ← r[a] / r[b] |
/// | Mod    | reg_a, reg_b, reg_out | r[out] ← r[a] MOD r[b] |
/// | Neg    | reg_a, reg_out | r[out] ← -r[a] |
/// | Eq     | reg_a, reg_b | flags_zero ← (r[a] == r[b]) |
/// | And    | reg_a, reg_b, reg_out | r[out] ← r[a] & r[b] |
/// | Or     | reg_a, reg_b, reg_out | r[out] ← r[a] \| r[b] |
/// | Xor    | reg_a, reg_b, reg_out | r[out] ← r[a] ^ r[b] |
/// | Halt   | 0 | End of scan cycle |
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Opcode {
    // Data movement
    Nop,
    Load,
    Store,

    // Arithmetic
    Add,
    Sub,
    Mul,
    Div,
    Mod,
    Neg,

    // Comparison (sets flags_zero)
    Eq,
    Neq,
    Gt,
    Lt,
    Gte,
    Lte,

    // Bitwise logic
    And,
    Or,
    Xor,
    Not,

    // Control flow
    Jump,
    JumpIf,

    // Special
    Halt,
}

/// One VM instruction — opcode plus 0–3 operands.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Instruction {
    pub opcode: Opcode,
    pub operands: Vec<Operand>,
}

impl Instruction {
    /// Create a new instruction with the given opcode and operands.
    pub fn new(opcode: Opcode, operands: Vec<Operand>) -> Self {
        Instruction { opcode, operands }
    }

    /// Convenience: Nop instruction.
    pub fn nop() -> Self {
        Instruction { opcode: Opcode::Nop, operands: vec![] }
    }

    /// Convenience: Halt instruction.
    pub fn halt() -> Self {
        Instruction { opcode: Opcode::Halt, operands: vec![] }
    }

    /// Convenience: Load immediate into register.
    pub fn load_imm(reg: u8, val: audesys_hal_core::HalValue) -> Self {
        Instruction {
            opcode: Opcode::Load,
            operands: vec![Operand::Register(reg), Operand::Immediate(val)],
        }
    }

    /// Convenience: Arithmetic binary operation with three registers.
    pub fn arith(opcode: Opcode, a: u8, b: u8, out: u8) -> Self {
        Instruction {
            opcode,
            operands: vec![Operand::Register(a), Operand::Register(b), Operand::Register(out)],
        }
    }

    /// Convenience: Compare two registers.
    pub fn cmp(opcode: Opcode, a: u8, b: u8) -> Self {
        Instruction { opcode, operands: vec![Operand::Register(a), Operand::Register(b)] }
    }

    /// Convenience: Unconditional jump to instruction index.
    pub fn jump(target: u32) -> Self {
        Instruction {
            opcode: Opcode::Jump,
            operands: vec![Operand::Immediate(audesys_hal_core::HalValue::U32(target))],
        }
    }

    /// Convenience: Conditional jump if zero flag is set.
    pub fn jump_if(target: u32) -> Self {
        Instruction {
            opcode: Opcode::JumpIf,
            operands: vec![Operand::Immediate(audesys_hal_core::HalValue::U32(target))],
        }
    }
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;
    use audesys_hal_core::HalValue;

    #[test]
    fn test_nop_halt_creation() {
        let nop = Instruction::nop();
        assert_eq!(nop.opcode, Opcode::Nop);
        assert!(nop.operands.is_empty());

        let halt = Instruction::halt();
        assert_eq!(halt.opcode, Opcode::Halt);
    }

    #[test]
    fn test_load_imm_creation() {
        let inst = Instruction::load_imm(0, HalValue::S32(42));
        assert_eq!(inst.opcode, Opcode::Load);
        assert_eq!(inst.operands.len(), 2);
        assert_eq!(inst.operands[0], Operand::Register(0));
        assert_eq!(inst.operands[1], Operand::Immediate(HalValue::S32(42)));
    }

    #[test]
    fn test_arith_creation() {
        let inst = Instruction::arith(Opcode::Add, 0, 1, 2);
        assert_eq!(inst.opcode, Opcode::Add);
        assert_eq!(inst.operands.len(), 3);
    }

    #[test]
    fn test_cmp_creation() {
        let inst = Instruction::cmp(Opcode::Eq, 0, 1);
        assert_eq!(inst.opcode, Opcode::Eq);
        assert_eq!(inst.operands.len(), 2);
    }

    #[test]
    fn test_jump_creation() {
        let inst = Instruction::jump(5);
        assert_eq!(inst.opcode, Opcode::Jump);
        assert_eq!(inst.operands[0], Operand::Immediate(HalValue::U32(5)));
    }

    #[test]
    fn test_jump_if_creation() {
        let inst = Instruction::jump_if(10);
        assert_eq!(inst.opcode, Opcode::JumpIf);
        assert_eq!(inst.operands[0], Operand::Immediate(HalValue::U32(10)));
    }

    #[test]
    fn test_all_opcodes_constructible() {
        let opcodes = [
            Opcode::Nop,
            Opcode::Load,
            Opcode::Store,
            Opcode::Add,
            Opcode::Sub,
            Opcode::Mul,
            Opcode::Div,
            Opcode::Mod,
            Opcode::Div,
            Opcode::Neg,
            Opcode::Eq,
            Opcode::Neq,
            Opcode::Gt,
            Opcode::Lt,
            Opcode::Gte,
            Opcode::Lte,
            Opcode::And,
            Opcode::Or,
            Opcode::Xor,
            Opcode::Not,
            Opcode::Jump,
            Opcode::JumpIf,
            Opcode::Halt,
        ];
        // Each opcode can be wrapped in an instruction
        for &opcode in &opcodes {
            let inst = Instruction::new(opcode, vec![]);
            assert_eq!(inst.opcode, opcode);
        }
    }
}
