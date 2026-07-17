//! Executor — sequential instruction interpreter for the HAL IR register VM.
//! 来源: docs/modules/compiler/hal-ir-design.md §3.1, §3.2

use audesys_hal_core::HalValue;

use crate::instruction::{Instruction, Opcode};
use crate::program::HalProgram;
use crate::types::Operand;
use crate::vm::Vm;

/// Result of executing one instruction.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExecutorResult {
    Continue,
    Halted,
}

/// Execution engine for HAL IR programs.
///
/// Wraps a Vm and a HalProgram, providing step-by-step instruction execution.
/// Transport integration (HalTransport) is deferred to Phase 2.
#[derive(Debug, Clone, PartialEq)]
pub struct Executor {
    vm: Vm,
    program: HalProgram,
}

impl Executor {
    /// Create a new executor from a compiled HalProgram.
    pub fn new(program: HalProgram) -> Self {
        Executor { vm: Vm::new(), program }
    }

    /// Access the underlying VM (read-only).
    pub fn vm(&self) -> &Vm {
        &self.vm
    }

    /// Access the underlying VM (mutable).
    pub fn vm_mut(&mut self) -> &mut Vm {
        &mut self.vm
    }

    /// Access the underlying program.
    pub fn program(&self) -> &HalProgram {
        &self.program
    }

    /// Execute one instruction at the current IP, then advance IP.
    ///
    /// Returns `Halted` when a Halt instruction is reached.
    ///
    /// # Panics
    /// Panics if IP is out of bounds.
    pub fn step(&mut self) -> ExecutorResult {
        let ip = self.vm.ip();
        assert!(ip < self.program.instructions.len(), "IP out of bounds: {ip}");

        let inst = self.program.instructions[ip].clone();
        let is_jump = inst.opcode == Opcode::Jump
            || inst.opcode == Opcode::JumpIf
            || inst.opcode == Opcode::Call;
        let result = self.execute_instruction(&inst);

        if !is_jump {
            self.vm.advance_ip();
        }

        result
    }

    /// Reset the VM to initial state.
    pub fn reset(&mut self) {
        self.vm.reset();
    }

    /// Execute until Halt, return total steps.
    pub fn run_to_halt(&mut self) -> usize {
        let mut steps = 0;
        loop {
            match self.step() {
                ExecutorResult::Halted => return steps + 1,
                ExecutorResult::Continue => steps += 1,
            }
        }
    }

    // ── Instruction dispatch ──

    fn execute_instruction(&mut self, inst: &Instruction) -> ExecutorResult {
        match inst.opcode {
            Opcode::Nop => ExecutorResult::Continue,

            Opcode::Store => self.exec_store(&inst.operands),
            Opcode::LoadIndex => self.exec_load_index(&inst.operands),

            Opcode::StoreIndex => self.exec_store_index(&inst.operands),

            Opcode::Load => self.exec_load(&inst.operands),

            Opcode::Add => self.exec_arith_binop(&inst.operands, |a, b| a + b),
            Opcode::Sub => self.exec_arith_binop(&inst.operands, |a, b| a - b),
            Opcode::Mul => self.exec_arith_binop(&inst.operands, |a, b| a * b),
            Opcode::Div => self.exec_arith_binop(&inst.operands, |a, b| {
                // ponytail: div-by-zero saturates to 0, full error model in Phase 2
                if b == HalValue::S32(0) || b == HalValue::F32(0.0) || b == HalValue::F64(0.0) {
                    HalValue::S32(0)
                } else {
                    a / b
                }
            }),
            Opcode::Mod => self.exec_arith_binop(&inst.operands, |a, b| {
                if b == HalValue::S32(0) || b == HalValue::F32(0.0) || b == HalValue::F64(0.0) {
                    HalValue::S32(0) // ponytail: mod-by-zero saturates to 0
                } else {
                    a % b
                }
            }),
            Opcode::Neg => self.exec_unary(&inst.operands, |a| -a),

            Opcode::Eq => self.exec_compare(&inst.operands, |a, b| a == b),
            Opcode::Neq => self.exec_compare(&inst.operands, |a, b| a != b),
            Opcode::Gt => self.exec_compare(&inst.operands, |a, b| a > b),
            Opcode::Lt => self.exec_compare(&inst.operands, |a, b| a < b),
            Opcode::Gte => self.exec_compare(&inst.operands, |a, b| a >= b),
            Opcode::Lte => self.exec_compare(&inst.operands, |a, b| a <= b),

            Opcode::And => self.exec_arith_binop(&inst.operands, |a, b| a & b),
            Opcode::Or => self.exec_arith_binop(&inst.operands, |a, b| a | b),
            Opcode::Xor => self.exec_arith_binop(&inst.operands, |a, b| a ^ b),
            Opcode::Not => self.exec_bitwise_not(&inst.operands),

            Opcode::Jump => self.exec_jump(&inst.operands),
            Opcode::JumpIf => self.exec_jump_if(&inst.operands),
            Opcode::Call => self.exec_call(&inst.operands),
            Opcode::Ret => self.exec_ret(&inst.operands),


            Opcode::TimerRun => self.exec_timer_run(&inst.operands),
            Opcode::ReadTimer => self.exec_read_timer(&inst.operands),

            Opcode::Halt => ExecutorResult::Halted,
        }
    }

    // ── Instruction implementations ──

    fn exec_load(&mut self, operands: &[Operand]) -> ExecutorResult {
        if operands.len() < 2 {
            return ExecutorResult::Continue;
        }
        let dest = match &operands[0] {
            Operand::Register(r) => *r,
            _ => return ExecutorResult::Continue,
        };
        let value = match &operands[1] {
            Operand::Immediate(v) => v.clone(),
            Operand::Register(r) => self.vm.read_register(*r),
            // ponytail: signal load deferred to Phase 2
            Operand::SignalName(_) => return ExecutorResult::Continue,
        };
        self.vm.write_register(dest, value);
        ExecutorResult::Continue
    }
    fn exec_load_index(&mut self, operands: &[Operand]) -> ExecutorResult {
        if operands.len() < 3 {
            return ExecutorResult::Continue;
        }
        let dest = match &operands[0] {
            Operand::Register(r) => *r,
            _ => return ExecutorResult::Continue,
        };
        let array_reg = match &operands[1] {
            Operand::Register(r) => *r,
            _ => return ExecutorResult::Continue,
        };
        let idx_reg = match &operands[2] {
            Operand::Register(r) => *r,
            _ => return ExecutorResult::Continue,
        };
        let array = self.vm.read_register(array_reg);
        let idx = self.vm.read_register(idx_reg);
        let idx_usize = Self::value_as_usize(&idx);
        let elem = array.index(idx_usize);
        self.vm.write_register(dest, elem);
        ExecutorResult::Continue
    }

    fn exec_store_index(&mut self, operands: &[Operand]) -> ExecutorResult {
        if operands.len() < 3 {
            return ExecutorResult::Continue;
        }
        let array_reg = match &operands[0] {
            Operand::Register(r) => *r,
            _ => return ExecutorResult::Continue,
        };
        let idx_reg = match &operands[1] {
            Operand::Register(r) => *r,
            _ => return ExecutorResult::Continue,
        };
        let value_reg = match &operands[2] {
            Operand::Register(r) => *r,
            _ => return ExecutorResult::Continue,
        };
        let array = self.vm.read_register(array_reg);
        let idx = self.vm.read_register(idx_reg);
        let value = self.vm.read_register(value_reg);
        let idx_usize = Self::value_as_usize(&idx);
        let updated = array.set_index(idx_usize, value);
        self.vm.write_register(array_reg, updated);
        ExecutorResult::Continue
    }

    fn value_as_usize(val: &HalValue) -> usize {
        match val {
            HalValue::S32(n) => *n as usize,
            HalValue::S16(n) => *n as usize,
            HalValue::S8(n) => *n as usize,
            HalValue::U32(n) => *n as usize,
            HalValue::U16(n) => *n as usize,
            HalValue::U8(n) => *n as usize,
            HalValue::S64(n) => *n as usize,
            HalValue::U64(n) => *n as usize,
            _ => 0,
        }
    }


    fn exec_arith_binop<F>(&mut self, operands: &[Operand], f: F) -> ExecutorResult
    where
        F: FnOnce(HalValue, HalValue) -> HalValue,
    {
        if operands.len() < 3 {
            return ExecutorResult::Continue;
        }
        let (a, b, out) = self.read_three_regs(operands);
        self.vm.write_register(out, f(a, b));
        ExecutorResult::Continue
    }

    fn exec_unary<F>(&mut self, operands: &[Operand], f: F) -> ExecutorResult
    where
        F: FnOnce(HalValue) -> HalValue,
    {
        if operands.len() < 2 {
            return ExecutorResult::Continue;
        }
        let a = self.read_reg(&operands[0]);
        let out = self.dest_reg(&operands[1]);
        self.vm.write_register(out, f(a));
        ExecutorResult::Continue
    }

    fn exec_compare<F>(&mut self, operands: &[Operand], f: F) -> ExecutorResult
    where
        F: FnOnce(HalValue, HalValue) -> bool,
    {
        if operands.len() < 2 {
            return ExecutorResult::Continue;
        }
        let a = self.read_reg(&operands[0]);
        let b = self.read_reg(&operands[1]);
        self.vm.set_flags_zero(f(a, b));
        ExecutorResult::Continue
    }

    fn exec_bitwise_not(&mut self, operands: &[Operand]) -> ExecutorResult {
        if operands.len() < 2 {
            return ExecutorResult::Continue;
        }
        let a = self.read_reg(&operands[0]);
        let out = self.dest_reg(&operands[1]);
        self.vm.write_register(out, !a);
        ExecutorResult::Continue
    }

    fn exec_jump(&mut self, operands: &[Operand]) -> ExecutorResult {
        if let Some(Operand::Immediate(HalValue::U32(target))) = operands.first() {
            self.vm.set_ip(*target as usize);
        }
        ExecutorResult::Continue
    }

    fn exec_jump_if(&mut self, operands: &[Operand]) -> ExecutorResult {
        if self.vm.flags_zero()
            && let Some(Operand::Immediate(HalValue::U32(target))) = operands.first()
        {
            self.vm.set_ip(*target as usize);
            return ExecutorResult::Continue;
        }
        self.vm.advance_ip();
        ExecutorResult::Continue
    }

    fn read_reg(&self, op: &Operand) -> HalValue {
        match op {
            Operand::Register(r) => self.vm.read_register(*r),
            _ => HalValue::S32(0),
        }
    }

    fn dest_reg(&self, op: &Operand) -> u8 {
        match op {
            Operand::Register(r) => *r,
            _ => 0,
        }
    }

    fn exec_store(&mut self, operands: &[Operand]) -> ExecutorResult {
        if operands.len() < 2 {
            return ExecutorResult::Continue;
        }
        let name = match &operands[0] {
            Operand::SignalName(n) => n.clone(),
            _ => return ExecutorResult::Continue,
        };
        let value = self.read_reg(&operands[1]);
        self.vm.write_signal(&name, value);
        ExecutorResult::Continue
    }

    fn exec_call(&mut self, operands: &[Operand]) -> ExecutorResult {
        let target = self.read_u32_operand(operands.first());
        let return_ip = self.vm.ip() + 1;
        self.vm.push_call_ip(return_ip);
        self.vm.set_ip(target as usize);
        ExecutorResult::Continue
    }

    fn exec_ret(&mut self, operands: &[Operand]) -> ExecutorResult {
        match self.vm.pop_call_ip() {
            Some(return_ip) => {
                // ponytail: result register copy not yet used (r0 convention)
                // full ABI: if operands.len() == 1, copy reg to r0
                if let Some(Operand::Register(r)) = operands.first() {
                    let val = self.vm.read_register(*r);
                    self.vm.write_register(0, val);
                }
                self.vm.set_ip(return_ip);
                ExecutorResult::Continue
            }
            None => {
                // ponytail: stack underflow → return as Halt (functionality guard)
                ExecutorResult::Halted
            }
        }
    }

    fn read_u32_operand(&self, operand: Option<&Operand>) -> u32 {
        match operand {
            Some(Operand::Immediate(HalValue::U32(v))) => *v,
            Some(Operand::Immediate(HalValue::S32(v))) => *v as u32,
            _ => 0,
        }
    }

    fn read_three_regs(&self, operands: &[Operand]) -> (HalValue, HalValue, u8) {
        (self.read_reg(&operands[0]), self.read_reg(&operands[1]), self.dest_reg(&operands[2]))
    }

    fn exec_timer_run(&mut self, operands: &[Operand]) -> ExecutorResult {
        // operands: [Imm(timer_idx), Reg(IN), Reg(PT_ms)]
        if operands.len() < 3 {
            return ExecutorResult::Continue;
        }
        let idx = match &operands[0] {
            Operand::Immediate(HalValue::U32(i)) => *i as usize,
            _ => return ExecutorResult::Continue,
        };
        if idx >= self.vm.timer_count() {
            return ExecutorResult::Continue;
        }
        let in_reg = match &operands[1] {
            Operand::Register(r) => *r,
            _ => return ExecutorResult::Continue,
        };
        let pt = match &operands[2] {
            Operand::Immediate(HalValue::U32(p)) => *p as u64,
            Operand::Immediate(HalValue::S32(p)) => *p as u64,
            _ => return ExecutorResult::Continue,
        };
        let in_val = self.vm.read_register(in_reg);
        let in_bool = in_val == HalValue::Bool(true);
        let cycle = self.vm.cycle_time();
        let timer = self.vm.timer_mut(idx);
        timer.preset_ms = pt;

        if !in_bool {
            timer.q = false;
            timer.elapsed_ms = 0;
        } else if timer.elapsed_ms >= timer.preset_ms {
            timer.q = true;
        } else {
            let elapsed = timer.elapsed_ms.saturating_add(cycle);
            timer.elapsed_ms = elapsed;
            if timer.elapsed_ms >= timer.preset_ms {
                timer.q = true;
                timer.elapsed_ms = timer.preset_ms;
            }
        }
        timer.in_val = in_bool;
        ExecutorResult::Continue
    }

    fn exec_read_timer(&mut self, operands: &[Operand]) -> ExecutorResult {
        // operands: [Imm(timer_idx), Reg(Q_dest), Reg(ET_dest)]
        if operands.len() < 3 {
            return ExecutorResult::Continue;
        }
        let idx = match &operands[0] {
            Operand::Immediate(HalValue::U32(i)) => *i as usize,
            _ => return ExecutorResult::Continue,
        };
        if idx >= self.vm.timer_count() {
            return ExecutorResult::Continue;
        }
        let q_dest = match &operands[1] {
            Operand::Register(r) => *r,
            _ => return ExecutorResult::Continue,
        };
        let et_dest = match &operands[2] {
            Operand::Register(r) => *r,
            _ => return ExecutorResult::Continue,
        };
        let timer = self.vm.timer(idx);
        let q_val = HalValue::Bool(timer.q);
        let et_val = HalValue::U32(timer.elapsed_ms as u32);
        self.vm.write_register(q_dest, q_val);
        self.vm.write_register(et_dest, et_val);
        ExecutorResult::Continue
    }

}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;
    use crate::instruction::Instruction;
    use crate::types::Operand;

    #[test]
    fn test_execute_simple_add() {
        let program = HalProgram::new(
            "test_add",
            vec![
                Instruction::load_imm(0, HalValue::S32(10)),
                Instruction::load_imm(1, HalValue::S32(20)),
                Instruction::arith(Opcode::Add, 0, 1, 2),
                Instruction::halt(),
            ],
        );
        let mut executor = Executor::new(program);
        executor.run_to_halt();
        assert_eq!(executor.vm().read_register(2), HalValue::S32(30));
    }

    #[test]
    fn test_execute_sub() {
        let program = HalProgram::new(
            "test_sub",
            vec![
                Instruction::load_imm(0, HalValue::S32(100)),
                Instruction::load_imm(1, HalValue::S32(30)),
                Instruction::arith(Opcode::Sub, 0, 1, 2),
                Instruction::halt(),
            ],
        );
        let mut executor = Executor::new(program);
        executor.run_to_halt();
        assert_eq!(executor.vm().read_register(2), HalValue::S32(70));
    }

    #[test]
    fn test_execute_mul() {
        let program = HalProgram::new(
            "test_mul",
            vec![
                Instruction::load_imm(0, HalValue::S32(7)),
                Instruction::load_imm(1, HalValue::S32(6)),
                Instruction::arith(Opcode::Mul, 0, 1, 2),
                Instruction::halt(),
            ],
        );
        let mut executor = Executor::new(program);
        executor.run_to_halt();
        assert_eq!(executor.vm().read_register(2), HalValue::S32(42));
    }

    #[test]
    fn test_execute_div() {
        let program = HalProgram::new(
            "test_div",
            vec![
                Instruction::load_imm(0, HalValue::S32(100)),
                Instruction::load_imm(1, HalValue::S32(4)),
                Instruction::arith(Opcode::Div, 0, 1, 2),
                Instruction::halt(),
            ],
        );
        let mut executor = Executor::new(program);
        executor.run_to_halt();
        assert_eq!(executor.vm().read_register(2), HalValue::S32(25));
    }

    #[test]
    fn test_execute_neg() {
        let program = HalProgram::new(
            "test_neg",
            vec![
                Instruction::load_imm(0, HalValue::S32(42)),
                Instruction::new(Opcode::Neg, vec![Operand::Register(0), Operand::Register(1)]),
                Instruction::halt(),
            ],
        );
        let mut executor = Executor::new(program);
        executor.run_to_halt();
        assert_eq!(executor.vm().read_register(1), HalValue::S32(-42));
    }

    #[test]
    fn test_execute_float_add() {
        let program = HalProgram::new(
            "test_fadd",
            vec![
                Instruction::load_imm(0, HalValue::F64(1.5)),
                Instruction::load_imm(1, HalValue::F64(2.5)),
                Instruction::arith(Opcode::Add, 0, 1, 2),
                Instruction::halt(),
            ],
        );
        let mut executor = Executor::new(program);
        executor.run_to_halt();
        assert_eq!(executor.vm().read_register(2), HalValue::F64(4.0));
    }

    #[test]
    fn test_compare_and_jump() {
        // R0=5, R1=5, Eq → flags_zero=true, JumpIf(5)→Halt
        let program = HalProgram::new(
            "test_jump",
            vec![
                Instruction::load_imm(0, HalValue::S32(5)),
                Instruction::load_imm(1, HalValue::S32(5)),
                Instruction::cmp(Opcode::Eq, 0, 1),
                Instruction::jump_if(5),
                Instruction::halt(), // unreachable
                Instruction::halt(), // jump target
            ],
        );
        let mut executor = Executor::new(program);
        let mut steps = 0;
        loop {
            match executor.step() {
                ExecutorResult::Halted => break,
                ExecutorResult::Continue => steps += 1,
            }
        }
        assert_eq!(steps, 4); // Load, Load, Eq, JumpIf
    }

    #[test]
    fn test_compare_not_equal_no_jump() {
        let program = HalProgram::new(
            "test_nojump",
            vec![
                Instruction::load_imm(0, HalValue::S32(5)),
                Instruction::load_imm(1, HalValue::S32(10)),
                Instruction::cmp(Opcode::Eq, 0, 1), // 5 == 10 → false
                Instruction::jump_if(6),
                Instruction::load_imm(2, HalValue::S32(99)),
                Instruction::halt(),
                Instruction::halt(), // jump target (unreachable)
            ],
        );
        let mut executor = Executor::new(program);
        executor.run_to_halt();
        assert_eq!(executor.vm().read_register(2), HalValue::S32(99));
        assert!(!executor.vm().flags_zero());
    }

    #[test]
    fn test_all_comparisons() {
        // Gt: 100 > 50 → true
        let mut ex = Executor::new(HalProgram::new(
            "gt",
            vec![
                Instruction::load_imm(0, HalValue::S32(100)),
                Instruction::load_imm(1, HalValue::S32(50)),
                Instruction::cmp(Opcode::Gt, 0, 1),
                Instruction::halt(),
            ],
        ));
        ex.run_to_halt();
        assert!(ex.vm().flags_zero());

        // Lt: 10 < 50 → true
        let mut ex = Executor::new(HalProgram::new(
            "lt",
            vec![
                Instruction::load_imm(0, HalValue::S32(10)),
                Instruction::load_imm(1, HalValue::S32(50)),
                Instruction::cmp(Opcode::Lt, 0, 1),
                Instruction::halt(),
            ],
        ));
        ex.run_to_halt();
        assert!(ex.vm().flags_zero());

        // Gte: 50 >= 50 → true
        let mut ex = Executor::new(HalProgram::new(
            "gte",
            vec![
                Instruction::load_imm(0, HalValue::S32(50)),
                Instruction::load_imm(1, HalValue::S32(50)),
                Instruction::cmp(Opcode::Gte, 0, 1),
                Instruction::halt(),
            ],
        ));
        ex.run_to_halt();
        assert!(ex.vm().flags_zero());

        // Lte: 30 <= 60 → true
        let mut ex = Executor::new(HalProgram::new(
            "lte",
            vec![
                Instruction::load_imm(0, HalValue::S32(30)),
                Instruction::load_imm(1, HalValue::S32(60)),
                Instruction::cmp(Opcode::Lte, 0, 1),
                Instruction::halt(),
            ],
        ));
        ex.run_to_halt();
        assert!(ex.vm().flags_zero());

        // Neq: 1 != 2 → true
        let mut ex = Executor::new(HalProgram::new(
            "neq",
            vec![
                Instruction::load_imm(0, HalValue::S32(1)),
                Instruction::load_imm(1, HalValue::S32(2)),
                Instruction::cmp(Opcode::Neq, 0, 1),
                Instruction::halt(),
            ],
        ));
        ex.run_to_halt();
        assert!(ex.vm().flags_zero());
    }

    #[test]
    fn test_unconditional_jump() {
        let program = HalProgram::new(
            "test_jmp",
            vec![
                Instruction::jump(3),
                Instruction::load_imm(0, HalValue::S32(99)), // skipped
                Instruction::load_imm(1, HalValue::S32(99)), // skipped
                Instruction::halt(),
            ],
        );
        let mut executor = Executor::new(program);
        let steps = executor.run_to_halt();
        assert_eq!(steps, 2); // Jump → Halt
        assert_eq!(executor.vm().read_register(0), HalValue::S32(0));
    }

    #[test]
    fn test_nop_continues() {
        let program = HalProgram::new(
            "test_nop",
            vec![Instruction::nop(), Instruction::nop(), Instruction::halt()],
        );
        let mut executor = Executor::new(program);
        let steps = executor.run_to_halt();
        assert_eq!(steps, 3);
    }

    #[test]
    fn test_executor_reset() {
        let program = HalProgram::new(
            "test_reset",
            vec![Instruction::load_imm(0, HalValue::S32(42)), Instruction::halt()],
        );
        let mut executor = Executor::new(program);
        executor.run_to_halt();
        assert_eq!(executor.vm().read_register(0), HalValue::S32(42));

        executor.reset();
        assert_eq!(executor.vm().read_register(0), HalValue::S32(0));
        assert_eq!(executor.vm().ip(), 0);

        executor.run_to_halt();
        assert_eq!(executor.vm().read_register(0), HalValue::S32(42));
    }

    #[test]
    fn test_bitwise_and_or_not() {
        let mut ex = Executor::new(HalProgram::new(
            "and",
            vec![
                Instruction::load_imm(0, HalValue::S32(0b1100)),
                Instruction::load_imm(1, HalValue::S32(0b1010)),
                Instruction::arith(Opcode::And, 0, 1, 2),
                Instruction::halt(),
            ],
        ));
        ex.run_to_halt();
        assert_eq!(ex.vm().read_register(2), HalValue::S32(0b1000));

        let mut ex = Executor::new(HalProgram::new(
            "or",
            vec![
                Instruction::load_imm(0, HalValue::S32(0b1100)),
                Instruction::load_imm(1, HalValue::S32(0b0011)),
                Instruction::arith(Opcode::Or, 0, 1, 2),
                Instruction::halt(),
            ],
        ));
        ex.run_to_halt();
        assert_eq!(ex.vm().read_register(2), HalValue::S32(0b1111));

        let mut ex = Executor::new(HalProgram::new(
            "not",
            vec![
                Instruction::load_imm(0, HalValue::S32(0)),
                Instruction::new(Opcode::Not, vec![Operand::Register(0), Operand::Register(1)]),
                Instruction::halt(),
            ],
        ));
        ex.run_to_halt();
        assert_eq!(ex.vm().read_register(1), HalValue::S32(-1));
    }

    #[test]
    fn test_step_by_step() {
        let program = HalProgram::new(
            "test_step",
            vec![
                Instruction::load_imm(0, HalValue::S32(1)),
                Instruction::load_imm(1, HalValue::S32(2)),
                Instruction::halt(),
            ],
        );
        let mut executor = Executor::new(program);

        assert_eq!(executor.step(), ExecutorResult::Continue);
        assert_eq!(executor.step(), ExecutorResult::Continue);
        assert_eq!(executor.step(), ExecutorResult::Halted);

        assert_eq!(executor.vm().read_register(0), HalValue::S32(1));
        assert_eq!(executor.vm().read_register(1), HalValue::S32(2));
    }

    #[test]
    fn test_bool_comparison() {
        let program = HalProgram::new(
            "test_bool_cmp",
            vec![
                Instruction::load_imm(0, HalValue::Bool(true)),
                Instruction::load_imm(1, HalValue::Bool(true)),
                Instruction::cmp(Opcode::Eq, 0, 1),
                Instruction::halt(),
            ],
        );
        let mut executor = Executor::new(program);
        executor.run_to_halt();
        assert!(executor.vm().flags_zero());
    }

    #[test]
    fn test_load_from_register() {
        let program = HalProgram::new(
            "test_load_reg",
            vec![
                Instruction::load_imm(0, HalValue::S32(77)),
                Instruction::new(Opcode::Load, vec![Operand::Register(1), Operand::Register(0)]),
                Instruction::halt(),
            ],
        );
        let mut executor = Executor::new(program);
        executor.run_to_halt();
        assert_eq!(executor.vm().read_register(1), HalValue::S32(77));
    }
}

#[test]
fn test_execute_store() {
    let program = HalProgram::new(
        "test_store",
        vec![
            Instruction::load_imm(0, HalValue::S32(42)),
            Instruction::new(
                Opcode::Store,
                vec![Operand::SignalName("x".into()), Operand::Register(0)],
            ),
            Instruction::halt(),
        ],
    );
    let mut executor = Executor::new(program);
    executor.run_to_halt();
    assert_eq!(executor.vm().read_signal("x").unwrap(), &HalValue::S32(42),);
    assert!(executor.vm().read_signal("y").is_none());
}
