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
    /// Function call: push return address, jump to function
    Call,
    /// Return from function: pop return address, jump back
    Ret,

    // Array access
    LoadIndex,
    StoreIndex,
    // Timer
    TimerRun,
    ReadTimer,
    // Counter
    CounterRun,
    ReadCounter,
    // SR/RS flip-flops
    SrRun,
    ReadSr,
    // R_TRIG/F_TRIG edge detection
    EdgeRun,
    ReadEdge,

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

    /// Convenience: Function call (push IP+1, jump to function at instruction index).
    pub fn call(target: u32) -> Self {
        Instruction {
            opcode: Opcode::Call,
            operands: vec![Operand::Immediate(audesys_hal_core::HalValue::U32(target))],
        }
    }

    /// Convenience: Return from function (pop return address, optionally copy result).
    pub fn ret(result_reg: Option<u8>) -> Self {
        let operands = result_reg.map(|r| vec![Operand::Register(r)]).unwrap_or_default();
        Instruction { opcode: Opcode::Ret, operands }
    }
    /// Convenience: Load array element at index into dest_reg.
    /// Operands: dest_reg, array_reg, index_reg
    pub fn load_index(dest: u8, array: u8, index: u8) -> Self {
        Instruction {
            opcode: Opcode::LoadIndex,
            operands: vec![Operand::Register(dest), Operand::Register(array), Operand::Register(index)],
        }
    }

    /// Convenience: Store value_reg into array_reg at index_reg.
    /// Operands: array_reg, index_reg, value_reg
    pub fn store_index(array: u8, index: u8, value: u8) -> Self {
        Instruction {
            opcode: Opcode::StoreIndex,
            operands: vec![Operand::Register(array), Operand::Register(index), Operand::Register(value)],
        }
    }
    /// Convenience: timer run — tick state machine.
    /// operands: [Imm(timer_idx), Reg(IN), Imm(PT_ms), Imm(kind: 0=TON,1=TOF,2=TP)]
    pub fn timer_run(timer_idx: u8, in_reg: u8, pt_ms: u32, kind: u8) -> Self {
        Instruction {
            opcode: Opcode::TimerRun,
            operands: vec![
                Operand::Immediate(audesys_hal_core::HalValue::U32(timer_idx as u32)),
                Operand::Register(in_reg),
                Operand::Immediate(audesys_hal_core::HalValue::U32(pt_ms)),
                Operand::Immediate(audesys_hal_core::HalValue::U32(kind as u32)),
            ],
        }
    }

    /// Convenience: Read timer Q and ET into registers.
    /// operands: [Imm(timer_idx), Reg(Q_dest), Reg(ET_dest)]
    pub fn read_timer(timer_idx: u8, q_dest: u8, et_dest: u8) -> Self {
        Instruction {
            opcode: Opcode::ReadTimer,
            operands: vec![
                Operand::Immediate(audesys_hal_core::HalValue::U32(timer_idx as u32)),
                Operand::Register(q_dest),
                Operand::Register(et_dest),
            ],
        }
    }
    /// Convenience: counter run — tick state machine.
    /// operands: [Imm(counter_idx), Reg(CU), Reg(CD), Imm(PV), Imm(kind: 0=CTU,1=CTD,2=CTUD)]
    /// operands: [Imm(counter_idx), Reg(CU), Reg(CD), Imm(PV), Imm(kind: 0=CTU,1=CTD,2=CTUD)]
    pub fn counter_run(counter_idx: u8, cu_reg: u8, cd_reg: u8, pv: u32, kind: u8) -> Self {
        Instruction {
            opcode: Opcode::CounterRun,
            operands: vec![
                Operand::Immediate(audesys_hal_core::HalValue::U32(counter_idx as u32)),
                Operand::Register(cu_reg),
                Operand::Register(cd_reg),
                Operand::Immediate(audesys_hal_core::HalValue::U32(pv)),
                Operand::Immediate(audesys_hal_core::HalValue::U32(kind as u32)),
            ],
        }
    }

    /// Convenience: Read counter Q and CV into registers.
    /// operands: [Imm(counter_idx), Reg(Q_dest), Reg(CV_dest)]
    pub fn read_counter(counter_idx: u8, q_dest: u8, cv_dest: u8) -> Self {
        Instruction {
            opcode: Opcode::ReadCounter,
            operands: vec![
                Operand::Immediate(audesys_hal_core::HalValue::U32(counter_idx as u32)),
                Operand::Register(q_dest),
                Operand::Register(cv_dest),
            ],
        }
    }

    /// Convenience: SR/RS run — tick state machine.
    /// operands: [Imm(idx), Reg(S1), Reg(R), Imm(kind: 0=SR,1=RS)]
    pub fn sr_run(idx: u8, s1_reg: u8, r_reg: u8, kind: u8) -> Self {
        Instruction {
            opcode: Opcode::SrRun,
            operands: vec![
                Operand::Immediate(audesys_hal_core::HalValue::U32(idx as u32)),
                Operand::Register(s1_reg),
                Operand::Register(r_reg),
                Operand::Immediate(audesys_hal_core::HalValue::U32(kind as u32)),
            ],
        }
    }

    /// Convenience: Read SR/RS Q1 and Q2 into registers.
    /// operands: [Imm(idx), Reg(Q1_dest), Reg(Q2_dest)]
    pub fn read_sr(idx: u8, q1_dest: u8, q2_dest: u8) -> Self {
        Instruction {
            opcode: Opcode::ReadSr,
            operands: vec![
                Operand::Immediate(audesys_hal_core::HalValue::U32(idx as u32)),
                Operand::Register(q1_dest),
                Operand::Register(q2_dest),
            ],
        }
    }

    /// Convenience: Edge detection run.
    /// operands: [Imm(idx), Reg(CLK), Imm(kind: 0=R_TRIG,1=F_TRIG)]
    pub fn edge_run(idx: u8, clk_reg: u8, kind: u8) -> Self {
        Instruction {
            opcode: Opcode::EdgeRun,
            operands: vec![
                Operand::Immediate(audesys_hal_core::HalValue::U32(idx as u32)),
                Operand::Register(clk_reg),
                Operand::Immediate(audesys_hal_core::HalValue::U32(kind as u32)),
            ],
        }
    }

    /// Convenience: Read edge detection Q into register.
    /// operands: [Imm(idx), Reg(Q_dest)]
    pub fn read_edge(idx: u8, q_dest: u8) -> Self {
        Instruction {
            opcode: Opcode::ReadEdge,
            operands: vec![
                Operand::Immediate(audesys_hal_core::HalValue::U32(idx as u32)),
                Operand::Register(q_dest),
            ],
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
            Opcode::Call,
            Opcode::Ret,
            Opcode::LoadIndex,
            Opcode::StoreIndex,
            Opcode::TimerRun,
            Opcode::ReadTimer,
            Opcode::CounterRun,
            Opcode::ReadCounter,
            Opcode::SrRun,
            Opcode::ReadSr,
            Opcode::EdgeRun,
            Opcode::ReadEdge,
            Opcode::Halt,
        ];
        // Each opcode can be wrapped in an instruction
        for &opcode in &opcodes {
            let inst = Instruction::new(opcode, vec![]);
            assert_eq!(inst.opcode, opcode);
        }
    }
}
