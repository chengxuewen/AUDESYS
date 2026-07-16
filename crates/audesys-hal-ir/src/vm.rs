//! Register VM — 16 general-purpose registers, flags, instruction pointer.
//! 来源: docs/modules/compiler/hal-ir-design.md §1.3, §3.1

use audesys_hal_core::HalValue;

/// Number of general-purpose registers (r0–r15).
pub const REGISTER_COUNT: usize = 16;

/// Virtual machine state — 16 registers + comparison flags + instruction pointer.
///
/// # Register layout
/// - r0–r15: general-purpose, initialized to HalValue::S32(0)
/// - No stack, no heap (Phase 1)
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
}

impl Vm {
    /// Create a new VM with all registers initialized to S32(0).
    pub fn new() -> Self {
        Vm { registers: std::array::from_fn(|_| HalValue::S32(0)), flags_zero: false, ip: 0 }
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
}
