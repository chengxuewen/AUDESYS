//! Register VM — 16 general-purpose registers, flags, instruction pointer.
//! 来源: docs/modules/compiler/hal-ir-design.md §1.3, §3.1

use audesys_hal_core::HalValue;
use std::collections::HashMap;

/// Number of general-purpose registers (r0–r15).

/// Timer kind: TON (on-delay), TOF (off-delay), TP (pulse).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TimerKind {
    /// TON: IN=true starts timing, Q=true after ET>=PT
    Ton,
    /// TOF: IN=false starts timing, Q stays true until ET>=PT
    Tof,
    /// TP: IN rising edge triggers fixed-duration Q pulse
    Tp,
}

/// Per-timer state for TON/TOF/TP timers.
/// ponytail: ms resolution, in-VM, cycle-driven
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TimerState {
    /// Timer kind
    pub kind: TimerKind,
    /// Current IN value
    pub in_val: bool,
    /// Elapsed time in milliseconds
    pub elapsed_ms: u64,
    /// Current Q (output) value
    pub q: bool,
    /// Preset time PT in milliseconds
    pub preset_ms: u64,
}

/// Counter kind: CTU (up), CTD (down), CTUD (up-down).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CounterKind {
    /// CTU: CU rising edge increments CV, Q when CV>=PV, R resets CV=0
    Ctu,
    /// CTD: CD rising edge decrements CV, Q when CV<=0, LD loads CV=PV
    Ctd,
    /// CTUD: CU up / CD down, QU when CV>=PV, QD when CV<=0
    Ctud,
}

/// Per-counter state for CTU/CTD/CTUD counters.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CounterState {
    pub kind: CounterKind,
    pub cu_val: bool,
    pub cd_val: bool,
    pub cv: u32,
    pub pv: u32,
    pub q: bool,
    pub qu: bool,
    pub qd: bool,
}

/// SR/RS flip-flop kind.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SrKind {
    /// SR: Set-dominant — S1=true sets Q1, R=true resets, S1 wins in conflict
    Sr,
    /// RS: Reset-dominant — R=true resets Q1, S1=true sets, R wins in conflict
    Rs,
}

/// Per-function-block state for SR/RS flip-flops.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SrState {
    pub kind: SrKind,
    pub s1: bool,
    pub r: bool,
    pub q1: bool,
    pub q2: bool,
}

/// Per-function-block state for R_TRIG/F_TRIG edge detectors.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EdgeState {
    /// 0=R_TRIG, 1=F_TRIG
    pub kind: u8,
    pub last_clk: bool,
    pub q: bool,
}

pub const REGISTER_COUNT: usize = 16;

/// Virtual machine state — 16 registers + comparison flags + instruction pointer.
///
/// # Register layout
/// - r0–r15: general-purpose, initialized to HalValue::S32(0)
/// - Call stack: pushed on Call, popped on Ret
///
/// # Flags
/// - `flags_zero`: set by comparison instructions (Eq, Neq, Gt, Lt, Gte, Lte)
/// - `flags_sign`, `flags_overflow`: reserved for Phase 2+
#[derive(Debug, Clone, PartialEq)]
pub struct Vm {
    /// General-purpose registers r0–r15
    registers: [HalValue; REGISTER_COUNT],
    /// Zero flag — set when comparison result is true
    flags_zero: bool,
    /// Instruction pointer — index into program instruction list
    ip: usize,
    /// Signal table: name → value, populated by Store instructions
    /// ponytail: simple HashMap, full signal binding resolution in Phase 2
    signals: HashMap<String, HalValue>,
    /// Call stack: pushed on Call (ip→), popped on Ret
    /// ponytail: simple Vec<usize>, frame save/restore in Phase 2
    call_stack: Vec<usize>,
    /// Timer states indexed by timer index (position in Vec)
    /// ponytail: simple Vec, max 16 timers (matching register count)
    timers: Vec<TimerState>,
    /// Counter states indexed by counter index
    /// ponytail: simple Vec, max 16 counters (matching register count)
    counters: Vec<CounterState>,
    /// SR/RS flip-flop states indexed by index
    srs: Vec<SrState>,
    /// Edge detector states indexed by index
    edges: Vec<EdgeState>,
    cycle_time_ms: u64,
}

impl Vm {
    /// Create a new VM with all registers initialized to S32(0).
    pub fn new() -> Self {
        Vm {
            registers: std::array::from_fn(|_| HalValue::S32(0)),
            flags_zero: false,
            ip: 0,
            signals: HashMap::new(),
            call_stack: Vec::new(),
            timers: Vec::new(),
            counters: Vec::new(),
            srs: Vec::new(),
            edges: Vec::new(),
            cycle_time_ms: 0,
        }
    }

    /// Read the value in register `idx` (0–15).
    ///
    /// # Panics
    /// Panics if `idx >= REGISTER_COUNT`.
    pub fn read_register(&self, idx: u8) -> HalValue {
        assert!((idx as usize) < REGISTER_COUNT, "register index out of bounds: {idx}");
        self.registers[idx as usize].clone()
    }

    /// Write `val` into register `idx` (0–15).
    ///
    /// # Panics
    /// Panics if `idx >= REGISTER_COUNT`.
    pub fn write_register(&mut self, idx: u8, val: HalValue) {
        assert!((idx as usize) < REGISTER_COUNT, "register index out of bounds: {idx}");
        self.registers[idx as usize] = val;
    }

    /// Read the zero flag.
    pub fn flags_zero(&self) -> bool {
        self.flags_zero
    }

    /// Set the zero flag.
    pub fn set_flags_zero(&mut self, val: bool) {
        self.flags_zero = val;
    }

    /// Read the instruction pointer.
    pub fn ip(&self) -> usize {
        self.ip
    }

    /// Set the instruction pointer (used by Jump/JumpIf).
    pub fn set_ip(&mut self, val: usize) {
        self.ip = val;
    }

    /// Advance the instruction pointer by 1 (normal sequential execution).
    pub fn advance_ip(&mut self) {
        self.ip += 1;
    }

    /// Reset IP to 0 (for next scan cycle).
    pub fn reset_ip(&mut self) {
        self.ip = 0;
    }

    /// Reset all state: registers to S32(0), flags to false, IP to 0.
    pub fn reset(&mut self) {
        for reg in &mut self.registers {
            *reg = HalValue::S32(0);
        }
        self.flags_zero = false;
        self.ip = 0;
        self.signals.clear();
        self.call_stack.clear();
    }

    /// Push current IP+1 onto the call stack (used by Call opcode).
    pub fn push_call_ip(&mut self, return_ip: usize) {
        self.call_stack.push(return_ip);
    }

    /// Pop return IP from the call stack (used by Ret opcode).
    /// Returns None if the call stack is empty (stack underflow guard).
    pub fn pop_call_ip(&mut self) -> Option<usize> {
        self.call_stack.pop()
    }

    /// Current call depth (for diagnostics / recursion guard).
    pub fn call_depth(&self) -> usize {
        self.call_stack.len()
    }

    /// Write a named signal into the signal table.
    pub fn write_signal(&mut self, name: &str, value: HalValue) {
        self.signals.insert(name.to_string(), value);
    }

    /// Read a named signal from the signal table.
    pub fn read_signal(&self, name: &str) -> Option<&HalValue> {
        self.signals.get(name)
    }

    /// Return all signal names currently in the table.
    pub fn signal_names(&self) -> Vec<&String> {
        self.signals.keys().collect()
    }

    /// Set the cycle time before each engine cycle.
    pub fn set_cycle_time(&mut self, ms: u64) {
        self.cycle_time_ms = ms;
    }

    /// Get the current cycle time.
    pub fn cycle_time(&self) -> u64 {
        self.cycle_time_ms
    }

    /// Add a new timer with given kind and preset (returns timer index).
    pub fn add_timer(&mut self, kind: TimerKind, preset_ms: u64) -> usize {
        let idx = self.timers.len();
        self.timers.push(TimerState { kind, in_val: false, elapsed_ms: 0, q: false, preset_ms });
        idx
    }

    /// Get a reference to a timer state.
    pub fn timer(&self, idx: usize) -> &TimerState {
        &self.timers[idx]
    }

    /// Get a mutable reference to a timer state.
    pub fn timer_mut(&mut self, idx: usize) -> &mut TimerState {
        &mut self.timers[idx]
    }

    /// Number of timers allocated.
    pub fn timer_count(&self) -> usize {
        self.timers.len()
    }

    /// Add a new counter with given kind and preset value.
    pub fn add_counter(&mut self, kind: CounterKind, pv: u32) -> usize {
        let idx = self.counters.len();
        self.counters.push(CounterState {
            kind,
            cu_val: false,
            cd_val: false,
            cv: 0,
            pv,
            q: false,
            qu: false,
            qd: false,
        });
        idx
    }

    /// Get a reference to a counter state.
    pub fn counter(&self, idx: usize) -> &CounterState {
        &self.counters[idx]
    }

    /// Get a mutable reference to a counter state.
    pub fn counter_mut(&mut self, idx: usize) -> &mut CounterState {
        &mut self.counters[idx]
    }

    /// Number of counters allocated.
    pub fn counter_count(&self) -> usize {
        self.counters.len()
    }

    /// Add a new SR/RS flip-flop (returns index).
    pub fn add_sr(&mut self, kind: SrKind) -> usize {
        let idx = self.srs.len();
        self.srs.push(SrState { kind, s1: false, r: false, q1: false, q2: false });
        idx
    }

    /// Get a reference to an SR state.
    pub fn sr(&self, idx: usize) -> &SrState {
        &self.srs[idx]
    }

    /// Get a mutable reference to an SR state.
    pub fn sr_mut(&mut self, idx: usize) -> &mut SrState {
        &mut self.srs[idx]
    }

    /// Number of SR/RS flip-flops allocated.
    pub fn sr_count(&self) -> usize {
        self.srs.len()
    }

    /// Add a new edge detector (returns index).
    pub fn add_edge(&mut self) -> usize {
        let idx = self.edges.len();
        self.edges.push(EdgeState { kind: 0, last_clk: false, q: false });
        idx
    }

    /// Get a reference to an edge state.
    pub fn edge(&self, idx: usize) -> &EdgeState {
        &self.edges[idx]
    }

    /// Get a mutable reference to an edge state.
    pub fn edge_mut(&mut self, idx: usize) -> &mut EdgeState {
        &mut self.edges[idx]
    }

    /// Number of edge detectors allocated.
    pub fn edge_count(&self) -> usize {
        self.edges.len()
    }
}

impl Default for Vm {
    fn default() -> Self {
        Vm::new()
    }
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vm_read_write_register() {
        let mut vm = Vm::new();
        vm.write_register(0, HalValue::S32(42));
        assert_eq!(vm.read_register(0), HalValue::S32(42));
    }

    #[test]
    fn test_vm_all_registers_init_zero() {
        let vm = Vm::new();
        for i in 0..16 {
            assert_eq!(vm.read_register(i as u8), HalValue::S32(0));
        }
    }

    #[test]
    fn test_vm_write_all_registers() {
        let mut vm = Vm::new();
        for i in 0..16u8 {
            vm.write_register(i, HalValue::U32(i as u32));
        }
        for i in 0..16u8 {
            assert_eq!(vm.read_register(i), HalValue::U32(i as u32));
        }
    }

    #[test]
    fn test_vm_flags_zero_default() {
        let vm = Vm::new();
        assert!(!vm.flags_zero());
    }

    #[test]
    fn test_vm_set_flags_zero() {
        let mut vm = Vm::new();
        vm.set_flags_zero(true);
        assert!(vm.flags_zero());
        vm.set_flags_zero(false);
        assert!(!vm.flags_zero());
    }

    #[test]
    fn test_vm_ip_default() {
        let vm = Vm::new();
        assert_eq!(vm.ip(), 0);
    }

    #[test]
    fn test_vm_ip_advance_and_reset() {
        let mut vm = Vm::new();
        assert_eq!(vm.ip(), 0);
        vm.advance_ip();
        assert_eq!(vm.ip(), 1);
        vm.advance_ip();
        assert_eq!(vm.ip(), 2);
        vm.set_ip(42);
        assert_eq!(vm.ip(), 42);
        vm.reset_ip();
        assert_eq!(vm.ip(), 0);
    }

    #[test]
    fn test_vm_full_reset() {
        let mut vm = Vm::new();
        vm.write_register(3, HalValue::F64(3.14));
        vm.set_flags_zero(true);
        vm.set_ip(10);
        vm.reset();
        assert_eq!(vm.read_register(3), HalValue::S32(0));
        assert!(!vm.flags_zero());
        assert_eq!(vm.ip(), 0);
    }

    #[test]
    fn test_vm_different_types() {
        let mut vm = Vm::new();
        vm.write_register(0, HalValue::Bool(true));
        vm.write_register(1, HalValue::F32(1.5));
        vm.write_register(2, HalValue::S64(-999));
        assert_eq!(vm.read_register(0), HalValue::Bool(true));
        assert_eq!(vm.read_register(1), HalValue::F32(1.5));
        assert_eq!(vm.read_register(2), HalValue::S64(-999));
    }

    #[test]
    #[should_panic(expected = "register index out of bounds")]
    fn test_vm_read_register_oob() {
        let vm = Vm::new();
        vm.read_register(16);
    }

    #[test]
    #[should_panic(expected = "register index out of bounds")]
    fn test_vm_write_register_oob() {
        let mut vm = Vm::new();
        vm.write_register(16, HalValue::S32(0));
    }

    #[test]
    fn test_vm_signal_store_and_read() {
        let mut vm = Vm::new();
        vm.write_signal("motor.speed", HalValue::F32(100.0));
        assert_eq!(vm.read_signal("motor.speed"), Some(&HalValue::F32(100.0)));
        assert!(vm.read_signal("nonexistent").is_none());
    }

    #[test]
    fn test_vm_signal_names() {
        let mut vm = Vm::new();
        vm.write_signal("a", HalValue::S32(1));
        vm.write_signal("b", HalValue::S32(2));
        let mut names = vm.signal_names();
        names.sort();
        assert_eq!(names, vec!["a", "b"]);
    }

    #[test]
    fn test_vm_reset_clears_signals() {
        let mut vm = Vm::new();
        vm.write_signal("x", HalValue::S32(42));
        vm.reset();
        assert!(vm.read_signal("x").is_none());
        assert!(vm.signal_names().is_empty());
    }

    #[test]
    fn test_vm_call_stack_push_pop() {
        let mut vm = Vm::new();
        assert_eq!(vm.call_depth(), 0);
        vm.push_call_ip(42);
        assert_eq!(vm.call_depth(), 1);
        vm.push_call_ip(100);
        assert_eq!(vm.call_depth(), 2);
        assert_eq!(vm.pop_call_ip(), Some(100));
        assert_eq!(vm.call_depth(), 1);
        assert_eq!(vm.pop_call_ip(), Some(42));
        assert_eq!(vm.call_depth(), 0);
    }

    #[test]
    fn test_vm_call_stack_underflow() {
        let mut vm = Vm::new();
        assert_eq!(vm.pop_call_ip(), None);
    }

    #[test]
    fn test_vm_reset_clears_call_stack() {
        let mut vm = Vm::new();
        vm.push_call_ip(10);
        vm.push_call_ip(20);
        vm.reset();
        assert_eq!(vm.call_depth(), 0);
    }
}
