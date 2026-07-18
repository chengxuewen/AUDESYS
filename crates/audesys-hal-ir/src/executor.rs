//! Executor — sequential instruction interpreter for the HAL IR register VM.
//! 来源: docs/modules/compiler/hal-ir-design.md §3.1, §3.2

use audesys_hal_core::HalValue;

use std::collections::HashSet;

use crate::instruction::{Instruction, Opcode};
use crate::program::HalProgram;
use crate::types::Operand;
use crate::vm::Vm;

/// Result of executing one instruction.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExecutorResult {
    Continue,
    Halted,
    /// Hit a breakpoint — execution paused, can resume via step() or run_to_halt().
    Breaked,
}

/// Single trace entry — records which instruction executed and VM state snapshot.
#[derive(Debug, Clone, PartialEq)]
pub struct TraceEntry {
    /// Instruction pointer at time of execution.
    pub ip: usize,
    /// The executed instruction opcode.
    pub opcode: Opcode,
    /// Snapshot of register 0 at time of execution (ponytail: r0 only, full snapshot in Phase 2).
    pub r0: HalValue,
}

/// Debug state — breakpoints, trace, and debug mode control.
/// Stored on Executor (not Vm) so it survives vm.reset() across engine cycles.
#[derive(Debug, Clone, PartialEq)]
pub struct DebugState {
    /// When true, step() checks breakpoints and records trace entries.
    pub debug_mode: bool,
    /// Set of instruction addresses (IP indices) where execution pauses.
    /// ponytail: HashSet for O(1) lookup, max 256 breakpoints in Phase 1
    pub breakpoints: HashSet<usize>,
    /// Trace buffer — stores one entry per executed instruction while debug_mode is on.
    /// ponytail: simple Vec, ring buffer if capacity matters
    pub trace_buffer: Vec<TraceEntry>,
}

impl DebugState {
    pub fn new() -> Self {
        DebugState {
            debug_mode: false,
            breakpoints: HashSet::new(),
            trace_buffer: Vec::new(),
        }
    }
}

/// Execution engine for HAL IR programs.
///
/// Wraps a Vm and a HalProgram, providing step-by-step instruction execution.
/// Transport integration (HalTransport) is deferred to Phase 2.
#[derive(Debug, Clone, PartialEq)]
pub struct Executor {
    vm: Vm,
    program: HalProgram,
    debug_state: DebugState,
}

impl Executor {
    /// Create a new executor from a compiled HalProgram.
    pub fn new(program: HalProgram) -> Self {
        Executor { vm: Vm::new(), program, debug_state: DebugState::new() }
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
    /// Returns `Halted` when a Halt instruction is reached, `Breaked` when
    /// debug_mode is on and the next IP is a breakpoint.
    ///
    /// # Panics
    /// Panics if IP is out of bounds.
    pub fn step(&mut self) -> ExecutorResult {
        let ip = self.vm.ip();
        assert!(ip < self.program.instructions.len(), "IP out of bounds: {ip}");

        // Check breakpoint BEFORE executing (so we pause at the marked line)
        if self.debug_state.debug_mode && self.debug_state.breakpoints.contains(&ip) {
            return ExecutorResult::Breaked;
        }

        let inst = self.program.instructions[ip].clone();
        let is_jump = inst.opcode == Opcode::Jump
            || inst.opcode == Opcode::JumpIf
            || inst.opcode == Opcode::Call;
        let opcode = inst.opcode;
        let result = self.execute_instruction(&inst);

        // Record trace entry after execution (before IP advances for non-jumps)
        if self.debug_state.debug_mode {
            let r0 = self.vm.read_register(0);
            self.debug_state.trace_buffer.push(TraceEntry { ip, opcode, r0 });
        }

        if !is_jump {
            self.vm.advance_ip();
        }

        result
    }

    /// Reset the VM to initial state. Debug state is preserved.
    pub fn reset(&mut self) {
        self.vm.reset();
    }

    /// Execute until Halt or Breaked, return total steps.
    pub fn run_to_halt(&mut self) -> usize {
        let mut steps = 0;
        loop {
            match self.step() {
                ExecutorResult::Halted => return steps + 1,
                ExecutorResult::Continue => steps += 1,
                ExecutorResult::Breaked => return steps + 1,
            }
        }
    }

    // ── Debug Methods ──

    /// Enable debug mode — breakpoints checked, trace recorded.
    pub fn enable_debug(&mut self) {
        self.debug_state.debug_mode = true;
    }

    /// Disable debug mode — breakpoints ignored, trace recording stops.
    pub fn disable_debug(&mut self) {
        self.debug_state.debug_mode = false;
    }

    /// Check if debug mode is enabled.
    pub fn is_debug_enabled(&self) -> bool {
        self.debug_state.debug_mode
    }

    /// Add a breakpoint at the given instruction address.
    /// Returns true if the breakpoint was newly added.
    pub fn add_breakpoint(&mut self, ip: usize) -> bool {
        self.debug_state.breakpoints.insert(ip)
    }

    /// Remove a breakpoint at the given instruction address.
    /// Returns true if the breakpoint was present and removed.
    pub fn remove_breakpoint(&mut self, ip: usize) -> bool {
        self.debug_state.breakpoints.remove(&ip)
    }

    /// List all currently set breakpoints (sorted).
    pub fn list_breakpoints(&self) -> Vec<usize> {
        let mut bps: Vec<usize> = self.debug_state.breakpoints.iter().copied().collect();
        bps.sort_unstable();
        bps
    }

    /// Clear all breakpoints.
    pub fn clear_breakpoints(&mut self) {
        self.debug_state.breakpoints.clear();
    }

    /// Access the trace buffer (read-only).
    pub fn trace_buffer(&self) -> &[TraceEntry] {
        &self.debug_state.trace_buffer
    }

    /// Clear the trace buffer.
    pub fn clear_trace(&mut self) {
        self.debug_state.trace_buffer.clear();
    }

    /// Resume execution from a breakpoint. Toggles debug off for one step to
    /// execute past the breakpoint, then re-enables debug.
    pub fn resume(&mut self) -> ExecutorResult {
        // ponytail: toggle debug off for one step to execute past the breakpoint
        self.debug_state.debug_mode = false;
        let result = self.step();
        self.debug_state.debug_mode = true;
        result
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
            Opcode::CounterRun => self.exec_counter_run(&inst.operands),
            Opcode::ReadCounter => self.exec_read_counter(&inst.operands),
            Opcode::SrRun => self.exec_sr_run(&inst.operands),
            Opcode::ReadSr => self.exec_read_sr(&inst.operands),
            Opcode::EdgeRun => self.exec_edge_run(&inst.operands),
            Opcode::ReadEdge => self.exec_read_edge(&inst.operands),

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
        // operands: [Imm(timer_idx), Reg(IN), Imm(PT_ms), Imm(kind)?]
        if operands.len() < 3 {
            return ExecutorResult::Continue;
        }
        let idx = match &operands[0] {
            Operand::Immediate(HalValue::U32(i)) => *i as usize,
            _ => return ExecutorResult::Continue,
        };
        // Read timer kind from 4th operand if present (0=TON, 1=TOF, 2=TP)
        let timer_kind = if operands.len() >= 4 {
            match &operands[3] {
                Operand::Immediate(HalValue::U32(k)) => match *k {
                    1 => crate::vm::TimerKind::Tof,
                    2 => crate::vm::TimerKind::Tp,
                    _ => crate::vm::TimerKind::Ton,
                },
                _ => crate::vm::TimerKind::Ton,
            }
        } else {
            crate::vm::TimerKind::Ton
        };
        // ponytail: auto-grow timers vec if index is larger
        while self.vm.timer_count() <= idx {
            self.vm.add_timer(timer_kind, 0);
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
        timer.kind = timer_kind;
        let prev_in = timer.in_val;

        match timer.kind {
            crate::vm::TimerKind::Ton => {
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
            }
            crate::vm::TimerKind::Tof => {
                if in_bool {
                    // IN true: Q=true immediately, reset ET
                    timer.q = true;
                    timer.elapsed_ms = 0;
                } else if timer.q {
                    // IN false while Q is true: start/continue timing
                    let elapsed = timer.elapsed_ms.saturating_add(cycle);
                    timer.elapsed_ms = elapsed;
                    if timer.elapsed_ms >= timer.preset_ms {
                        timer.q = false;
                        timer.elapsed_ms = timer.preset_ms;
                    }
                }
                // IN false and Q already false: ET stays 0
            }
            crate::vm::TimerKind::Tp => {
                // Detect rising edge: prev_in=false, in_bool=true
                if in_bool && !prev_in {
                    timer.q = true;
                    timer.elapsed_ms = 0;
                }
                // While Q is true: advance ET, check timeout, check IN fall
                if timer.q {
                    let elapsed = timer.elapsed_ms.saturating_add(cycle);
                    timer.elapsed_ms = elapsed;
                    if timer.elapsed_ms >= timer.preset_ms {
                        timer.q = false;
                        timer.elapsed_ms = timer.preset_ms;
                    }
                    // IN falling edge terminates pulse early
                    if !in_bool {
                        timer.q = false;
                    }
                }
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
        while self.vm.timer_count() <= idx {
            self.vm.add_timer(crate::vm::TimerKind::Ton, 0);
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

    fn exec_counter_run(&mut self, operands: &[Operand]) -> ExecutorResult {
        // operands: [Imm(counter_idx), Reg(CU), Reg(CD), Imm(PV), Imm(kind)]
        if operands.len() < 5 {
            return ExecutorResult::Continue;
        }
        let idx = match &operands[0] {
            Operand::Immediate(HalValue::U32(i)) => *i as usize,
            _ => return ExecutorResult::Continue,
        };
        // ponytail: auto-grow counters
        while self.vm.counter_count() <= idx {
            self.vm.add_counter(crate::vm::CounterKind::Ctu, 0);
        }
        let cu_reg = match &operands[1] {
            Operand::Register(r) => *r,
            _ => return ExecutorResult::Continue,
        };
        let cd_reg = match &operands[2] {
            Operand::Register(r) => *r,
            _ => return ExecutorResult::Continue,
        };
        let pv = match &operands[3] {
            Operand::Immediate(HalValue::U32(v)) => *v,
            _ => return ExecutorResult::Continue,
        };
        let kind_raw = match &operands[4] {
            Operand::Immediate(HalValue::U32(v)) => *v,
            _ => 0,
        };
        let cu_bool = match self.vm.read_register(cu_reg) {
            HalValue::Bool(b) => b,
            _ => false,
        };
        let cd_bool = match self.vm.read_register(cd_reg) {
            HalValue::Bool(b) => b,
            _ => false,
        };
        let counter = self.vm.counter_mut(idx);
        counter.pv = pv;
        // Set kind based on codegen encoding
        let kind = match kind_raw {
            0 => crate::vm::CounterKind::Ctu,
            1 => crate::vm::CounterKind::Ctd,
            _ => crate::vm::CounterKind::Ctud,
        };
        counter.kind = kind;

        let prev_cu = counter.cu_val;
        let prev_cd = counter.cd_val;
        counter.cu_val = cu_bool;
        counter.cd_val = cd_bool;

        match kind {
            crate::vm::CounterKind::Ctu => {
                // CU: rising edge increments CV, capped at PV
                if cu_bool && !prev_cu {
                    counter.cv = (counter.cv + 1).min(counter.pv);
                }
                counter.q = counter.cv >= counter.pv;
            }
            crate::vm::CounterKind::Ctd => {
                // CD: rising edge decrements CV, capped at 0
                if cd_bool && !prev_cd {
                    counter.cv = counter.cv.saturating_sub(1);
                }
                counter.q = counter.cv <= 0;
            }
            crate::vm::CounterKind::Ctud => {
                // CU rising edge: increment
                if cu_bool && !prev_cu {
                    counter.cv = (counter.cv + 1).min(counter.pv);
                }
                // CD rising edge: decrement
                if cd_bool && !prev_cd {
                    counter.cv = counter.cv.saturating_sub(1);
                }
                counter.qu = counter.cv >= counter.pv;
                counter.qd = counter.cv <= 0;
                counter.q = counter.qu;
            }
        }
        ExecutorResult::Continue
    }

    fn exec_read_counter(&mut self, operands: &[Operand]) -> ExecutorResult {
        // operands: [Imm(counter_idx), Reg(Q_dest), Reg(CV_dest)]
        if operands.len() < 3 {
            return ExecutorResult::Continue;
        }
        let idx = match &operands[0] {
            Operand::Immediate(HalValue::U32(i)) => *i as usize,
            _ => return ExecutorResult::Continue,
        };
        while self.vm.counter_count() <= idx {
            self.vm.add_counter(crate::vm::CounterKind::Ctu, 0);
        }
        let q_dest = match &operands[1] {
            Operand::Register(r) => *r,
            _ => return ExecutorResult::Continue,
        };
        let cv_dest = match &operands[2] {
            Operand::Register(r) => *r,
            _ => return ExecutorResult::Continue,
        };
        let counter = self.vm.counter(idx);
        let q = counter.q;
        let cv = counter.cv;
        // drop counter reference before mutable write_register
        self.vm.write_register(q_dest, HalValue::Bool(q));
        self.vm.write_register(cv_dest, HalValue::U32(cv));
        ExecutorResult::Continue
    }

    fn exec_sr_run(&mut self, operands: &[Operand]) -> ExecutorResult {
        // operands: [Imm(idx), Reg(S1), Reg(R), Imm(kind: 0=SR,1=RS)]
        if operands.len() < 4 {
            return ExecutorResult::Continue;
        }
        let idx = match &operands[0] {
            Operand::Immediate(HalValue::U32(i)) => *i as usize,
            _ => return ExecutorResult::Continue,
        };
        let s1 = match &operands[1] {
            Operand::Register(r) => match self.vm.read_register(*r) {
                HalValue::Bool(b) => b,
                _ => false,
            },
            _ => false,
        };
        let r = match &operands[2] {
            Operand::Register(reg) => match self.vm.read_register(*reg) {
                HalValue::Bool(b) => b,
                _ => false,
            },
            _ => false,
        };
        let kind_raw = match &operands[3] {
            Operand::Immediate(HalValue::U32(k)) => *k,
            _ => 0,
        };
        // ponytail: auto-grow
        while self.vm.sr_count() <= idx {
            let sk = if kind_raw == 1 { crate::vm::SrKind::Rs } else { crate::vm::SrKind::Sr };
            self.vm.add_sr(sk);
        }
        let state = self.vm.sr_mut(idx);
        // Update kind each cycle (codegen may re-emit with different kind)
        state.kind = if kind_raw == 1 { crate::vm::SrKind::Rs } else { crate::vm::SrKind::Sr };
        match state.kind {
            crate::vm::SrKind::Sr => {
                if s1 { state.q1 = true; state.q2 = false; }
                else if r { state.q1 = false; state.q2 = true; }
            }
            crate::vm::SrKind::Rs => {
                if r { state.q1 = false; state.q2 = true; }
                else if s1 { state.q1 = true; state.q2 = false; }
            }
        }
        state.s1 = s1;
        state.r = r;
        ExecutorResult::Continue
    }

    fn exec_read_sr(&mut self, operands: &[Operand]) -> ExecutorResult {
        // operands: [Imm(idx), Reg(Q1_dest), Reg(Q2_dest)]
        if operands.len() < 3 {
            return ExecutorResult::Continue;
        }
        let idx = match &operands[0] {
            Operand::Immediate(HalValue::U32(i)) => *i as usize,
            _ => return ExecutorResult::Continue,
        };
        while self.vm.sr_count() <= idx {
            self.vm.add_sr(crate::vm::SrKind::Sr);
        }
        let q1_dest = match &operands[1] {
            Operand::Register(r) => *r,
            _ => return ExecutorResult::Continue,
        };
        let q2_dest = match &operands[2] {
            Operand::Register(r) => *r,
            _ => return ExecutorResult::Continue,
        };
        let state = self.vm.sr(idx);
        let q1 = state.q1;
        let q2 = state.q2;
        self.vm.write_register(q1_dest, HalValue::Bool(q1));
        self.vm.write_register(q2_dest, HalValue::Bool(q2));
        ExecutorResult::Continue
    }

    fn exec_edge_run(&mut self, operands: &[Operand]) -> ExecutorResult {
        // operands: [Imm(idx), Reg(CLK), Imm(kind: 0=R_TRIG,1=F_TRIG)]
        if operands.len() < 3 {
            return ExecutorResult::Continue;
        }
        let idx = match &operands[0] {
            Operand::Immediate(HalValue::U32(i)) => *i as usize,
            _ => return ExecutorResult::Continue,
        };
        let clk = match &operands[1] {
            Operand::Register(r) => match self.vm.read_register(*r) {
                HalValue::Bool(b) => b,
                _ => false,
            },
            _ => false,
        };
        let kind = match &operands[2] {
            Operand::Immediate(HalValue::U32(k)) => *k as u8,
            _ => 0,
        };
        // ponytail: auto-grow
        while self.vm.edge_count() <= idx {
            self.vm.add_edge();
        }
        let state = self.vm.edge_mut(idx);
        state.kind = kind;
        state.q = match kind {
            0 => clk && !state.last_clk,   // R_TRIG: rising edge (CLK ∧ ¬last_CLK)
            1 => !clk && state.last_clk,   // F_TRIG: falling edge (¬CLK ∧ last_CLK)
            _ => false,
        };
        state.last_clk = clk;
        ExecutorResult::Continue
    }

    fn exec_read_edge(&mut self, operands: &[Operand]) -> ExecutorResult {
        // operands: [Imm(idx), Reg(Q_dest)]
        if operands.len() < 2 {
            return ExecutorResult::Continue;
        }
        let idx = match &operands[0] {
            Operand::Immediate(HalValue::U32(i)) => *i as usize,
            _ => return ExecutorResult::Continue,
        };
        while self.vm.edge_count() <= idx {
            self.vm.add_edge();
        }
        let q_dest = match &operands[1] {
            Operand::Register(r) => *r,
            _ => return ExecutorResult::Continue,
        };
        let state = self.vm.edge(idx);
        self.vm.write_register(q_dest, HalValue::Bool(state.q));
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
                ExecutorResult::Breaked => steps += 1,
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

    // ── Debug Tests ──

    #[test]
    fn test_debug_breakpoint_hit() {
        let program = HalProgram::new(
            "test_bp",
            vec![
                Instruction::load_imm(0, HalValue::S32(1)),
                Instruction::load_imm(1, HalValue::S32(2)),
                Instruction::arith(Opcode::Add, 0, 1, 2),
                Instruction::halt(),
            ],
        );
        let mut executor = Executor::new(program);
        executor.enable_debug();
        executor.add_breakpoint(2);

        assert_eq!(executor.step(), ExecutorResult::Continue); // load_imm r0
        assert_eq!(executor.step(), ExecutorResult::Continue); // load_imm r1
        assert_eq!(executor.step(), ExecutorResult::Breaked);  // breakpoint!
    }

    #[test]
    fn test_debug_no_breakpoint_without_debug_mode() {
        let program = HalProgram::new(
            "test_no_bp",
            vec![
                Instruction::load_imm(0, HalValue::S32(1)),
                Instruction::halt(),
            ],
        );
        let mut executor = Executor::new(program);
        executor.add_breakpoint(0);

        assert_eq!(executor.step(), ExecutorResult::Continue);
        assert_eq!(executor.step(), ExecutorResult::Halted);
        assert!(!executor.is_debug_enabled());
    }

    #[test]
    fn test_debug_add_remove_breakpoint() {
        let mut executor = Executor::new(HalProgram::new(
            "test_bp_ops",
            vec![Instruction::halt()],
        ));

        assert!(executor.add_breakpoint(0));
        assert!(!executor.add_breakpoint(0)); // duplicate
        assert_eq!(executor.list_breakpoints(), vec![0]);

        assert!(executor.remove_breakpoint(0));
        assert!(!executor.remove_breakpoint(0));
        assert!(executor.list_breakpoints().is_empty());
    }

    #[test]
    fn test_debug_clear_breakpoints() {
        let mut executor = Executor::new(HalProgram::new(
            "test_bp_clear",
            vec![Instruction::halt()],
        ));

        executor.add_breakpoint(0);
        executor.add_breakpoint(3);
        executor.add_breakpoint(7);
        assert_eq!(executor.list_breakpoints().len(), 3);

        executor.clear_breakpoints();
        assert!(executor.list_breakpoints().is_empty());
    }

    #[test]
    fn test_debug_trace_recording() {
        let program = HalProgram::new(
            "test_trace",
            vec![
                Instruction::load_imm(0, HalValue::S32(10)),
                Instruction::load_imm(1, HalValue::S32(20)),
                Instruction::arith(Opcode::Add, 0, 1, 2),
                Instruction::halt(),
            ],
        );
        let mut executor = Executor::new(program);
        executor.enable_debug();
        executor.run_to_halt();

        let trace = executor.trace_buffer();
        assert_eq!(trace.len(), 4);
        assert_eq!(trace[0].opcode, Opcode::Load);
        assert_eq!(trace[1].opcode, Opcode::Load);
        assert_eq!(trace[2].opcode, Opcode::Add);
        assert_eq!(trace[3].opcode, Opcode::Halt);
    }

    #[test]
    fn test_debug_trace_not_recorded_when_disabled() {
        let program = HalProgram::new(
            "test_trace_off",
            vec![
                Instruction::load_imm(0, HalValue::S32(1)),
                Instruction::halt(),
            ],
        );
        let mut executor = Executor::new(program);
        executor.run_to_halt();

        assert!(executor.trace_buffer().is_empty());
    }

    #[test]
    fn test_debug_clear_trace() {
        let program = HalProgram::new(
            "test_trace_clear",
            vec![
                Instruction::load_imm(0, HalValue::S32(1)),
                Instruction::halt(),
            ],
        );
        let mut executor = Executor::new(program);
        executor.enable_debug();
        executor.run_to_halt();
        assert_eq!(executor.trace_buffer().len(), 2);

        executor.clear_trace();
        assert!(executor.trace_buffer().is_empty());
    }

    #[test]
    fn test_debug_disable_reenable() {
        let mut executor = Executor::new(HalProgram::new(
            "test_enable",
            vec![Instruction::halt()],
        ));

        assert!(!executor.is_debug_enabled());
        executor.enable_debug();
        assert!(executor.is_debug_enabled());
        executor.disable_debug();
        assert!(!executor.is_debug_enabled());
    }

    #[test]
    fn test_debug_resume_past_breakpoint() {
        let program = HalProgram::new(
            "test_resume",
            vec![
                Instruction::load_imm(0, HalValue::S32(1)),
                Instruction::load_imm(1, HalValue::S32(2)),
                Instruction::arith(Opcode::Add, 0, 1, 2),
                Instruction::halt(),
            ],
        );
        let mut executor = Executor::new(program);
        executor.enable_debug();
        executor.add_breakpoint(1);

        assert_eq!(executor.step(), ExecutorResult::Continue); // load_imm r0
        assert_eq!(executor.step(), ExecutorResult::Breaked);  // break at IP=1
        assert_eq!(executor.resume(), ExecutorResult::Continue); // execute load_imm r1
        executor.run_to_halt();

        assert_eq!(executor.vm().read_register(2), HalValue::S32(3));
    }

    #[test]
    fn test_debug_trace_content() {
        let program = HalProgram::new(
            "test_trace_content",
            vec![
                Instruction::load_imm(0, HalValue::S32(42)),
                Instruction::halt(),
            ],
        );
        let mut executor = Executor::new(program);
        executor.enable_debug();
        executor.run_to_halt();

        let trace = executor.trace_buffer();
        assert_eq!(trace.len(), 2);
        assert_eq!(trace[0].ip, 0);
        assert_eq!(trace[0].opcode, Opcode::Load);
        assert_eq!(trace[0].r0, HalValue::S32(42));
        assert_eq!(trace[1].ip, 1);
        assert_eq!(trace[1].opcode, Opcode::Halt);
    }

    #[test]
    fn test_debug_state_survives_reset() {
        let program = HalProgram::new(
            "test_reset_debug",
            vec![
                Instruction::load_imm(0, HalValue::S32(1)),
                Instruction::halt(),
            ],
        );
        let mut executor = Executor::new(program);
        executor.enable_debug();
        executor.add_breakpoint(1);
        executor.run_to_halt();

        assert_eq!(executor.trace_buffer().len(), 1); // only load_imm recorded

        executor.reset();
        assert!(executor.is_debug_enabled());
        assert!(executor.list_breakpoints().contains(&1));
        assert_eq!(executor.trace_buffer().len(), 1); // trace survives reset
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
