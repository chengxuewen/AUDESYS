//! Codegen — IL AST to HAL IR instruction stream.
//!
//! Register layout:
//!   r0..r9  — user variables (max 10)
//!   r12     — TEMP1 (for NOTN ops)
//!   r13     — TEMP2 (reserved)
//!   r14     — CR (accumulator)
//!   r15     — TRUE_CONST (Bool(true), pre-loaded)
use crate::parser::{CompareOp, ILStatement};
use audesys_hal_core::HalValue;
use audesys_hal_ir::instruction::{Instruction, Opcode};
use audesys_hal_ir::types::Operand;
use std::collections::HashMap;

const USER_REG_START: u8 = 0;
const USER_REG_MAX: u8 = 9;
const TEMP1_REG: u8 = 12;
const CR_REG: u8 = 14;
const TRUE_REG: u8 = 15;

struct Codegen {
    instructions: Vec<Instruction>,
    var_map: HashMap<String, u8>,
    next_reg: u8,
    labels: HashMap<String, usize>,
    /// (instruction_index, label_name, is_conditional_jump_if)
    /// For JumpIf: index refers to the Eq/Neq instruction BEFORE the JumpIf.
    label_refs: Vec<(usize, String)>,
}


impl Codegen {
    fn new() -> Self {
        Self {
            instructions: Vec::new(),
            var_map: HashMap::new(),
            next_reg: USER_REG_START,
            labels: HashMap::new(),
            label_refs: Vec::new(),
        }
    }

    fn get_var_reg(&mut self, name: &str) -> u8 {
        if let Some(&r) = self.var_map.get(name) {
            r
        } else {
            let r = self.next_reg;
            if r > USER_REG_MAX {
                // ponytail: cap at 10 user variables, enough for typical IL programs
                panic!("too many IL variables (max 10): {name}");
            }
            self.next_reg += 1;
            self.var_map.insert(name.to_string(), r);
            r
        }
    }

    fn emit(&mut self, inst: Instruction) -> usize {
        let idx = self.instructions.len();
        self.instructions.push(inst);
        idx
    }

    fn current_ip(&self) -> usize {
        self.instructions.len()
    }

    fn emit_load_reg(&mut self, dest: u8, src: u8) {
        self.emit(Instruction::new(
            Opcode::Load,
            vec![Operand::Register(dest), Operand::Register(src)],
        ));
    }

    fn emit_load_imm(&mut self, dest: u8, val: HalValue) {
        self.emit(Instruction::new(
            Opcode::Load,
            vec![Operand::Register(dest), Operand::Immediate(val)],
        ));
    }

    fn emit_not(&mut self, src: u8, dest: u8) {
        self.emit(Instruction::new(
            Opcode::Not,
            vec![Operand::Register(src), Operand::Register(dest)],
        ));
    }

    fn emit_arith(&mut self, opcode: Opcode, a: u8, b: u8, out: u8) {
        self.emit(Instruction::new(
            opcode,
            vec![
                Operand::Register(a),
                Operand::Register(b),
                Operand::Register(out),
            ],
        ));
    }

    fn emit_cmp(&mut self, opcode: Opcode, a: u8, b: u8) {
        self.emit(Instruction::new(
            opcode,
            vec![Operand::Register(a), Operand::Register(b)],
        ));
    }

    fn emit_jump(&mut self, target: u32) {
        self.emit(Instruction::jump(target));
    }

    fn emit_jump_if(&mut self, target: u32) {
        self.emit(Instruction::jump_if(target));
    }

    /// After comparison sets flags_zero, materialize the boolean result into CR.
    fn materialize_cr_from_flags(&mut self) {
        // Pattern:
        //   JumpIf(materialize_true_ip)   // if flags, jump to "CR=true"
        //   Load(CR, Bool(false))          // default false
        //   Jump(materialize_done_ip)      // skip the true path
        // materialize_true_ip:
        //   Load(CR, Bool(true))           // true path
        // materialize_done_ip:
        let true_ip = (self.current_ip() + 3) as u32; // jumps over 2 instructions + this one
        let done_ip = (self.current_ip() + 5) as u32; // jumps over all 4 instructions (JumpIf, Load(false), Jump, Load(true))

        // 0: JumpIf(true_ip)  — true_ip is the Load(true) instruction
        self.emit_jump_if(true_ip);
        // 1: Load(CR, false)
        self.emit_load_imm(CR_REG, HalValue::Bool(false));
        // 2: Jump(done_ip)
        self.emit_jump(done_ip);
        // 3: Load(CR, true)
        self.emit_load_imm(CR_REG, HalValue::Bool(true));
        // 4: (done_ip — continuation)
    }

    // ponytail: emit a cmp+jump for conditional branches
    // For JumpIf (JMPC): emit Eq(CR, TRUE) then JumpIf
    // For JumpIfNot (JMPCN): emit Neq(CR, TRUE) then JumpIf
    fn emit_bool_test_and_jump(&mut self, label: &str, negate: bool) -> usize {
        let opcode = if negate { Opcode::Neq } else { Opcode::Eq };
        self.emit_cmp(opcode, CR_REG, TRUE_REG);
        // placeholder JumpIf, backpatched later
        let idx = self.current_ip();
        self.emit_jump_if(0);
        self.label_refs.push((idx, label.to_string()));
        idx
    }

    fn compile(mut self, stmts: &[ILStatement]) -> Vec<Instruction> {
        // Pre-load TRUE_CONST register
        self.emit_load_imm(TRUE_REG, HalValue::Bool(true));

        for stmt in stmts {
            match stmt {
                ILStatement::Label { name } => {
                    self.labels.insert(name.clone(), self.current_ip());
                }
                ILStatement::Load { var } => {
                    let r = self.get_var_reg(var);
                    self.emit_load_reg(CR_REG, r);
                }
                ILStatement::LoadNot { var } => {
                    let r = self.get_var_reg(var);
                    self.emit_load_reg(CR_REG, r);
                    self.emit_not(CR_REG, CR_REG);
                }
                ILStatement::Store { var } => {
                    let r = self.get_var_reg(var);
                    self.emit_load_reg(r, CR_REG);
                }
                ILStatement::And { var } => {
                    let r = self.get_var_reg(var);
                    self.emit_arith(Opcode::And, CR_REG, r, CR_REG);
                }
                ILStatement::AndNot { var } => {
                    let r = self.get_var_reg(var);
                    // TEMP1 = var; Not TEMP1; CR = CR & TEMP1
                    self.emit_load_reg(TEMP1_REG, r);
                    self.emit_not(TEMP1_REG, TEMP1_REG);
                    self.emit_arith(Opcode::And, CR_REG, TEMP1_REG, CR_REG);
                }
                ILStatement::Or { var } => {
                    let r = self.get_var_reg(var);
                    self.emit_arith(Opcode::Or, CR_REG, r, CR_REG);
                }
                ILStatement::OrNot { var } => {
                    let r = self.get_var_reg(var);
                    self.emit_load_reg(TEMP1_REG, r);
                    self.emit_not(TEMP1_REG, TEMP1_REG);
                    self.emit_arith(Opcode::Or, CR_REG, TEMP1_REG, CR_REG);
                }
                ILStatement::Xor { var } => {
                    let r = self.get_var_reg(var);
                    self.emit_arith(Opcode::Xor, CR_REG, r, CR_REG);
                }
                ILStatement::Add { var } => {
                    let r = self.get_var_reg(var);
                    self.emit_arith(Opcode::Add, CR_REG, r, CR_REG);
                }
                ILStatement::Sub { var } => {
                    let r = self.get_var_reg(var);
                    self.emit_arith(Opcode::Sub, CR_REG, r, CR_REG);
                }
                ILStatement::Mul { var } => {
                    let r = self.get_var_reg(var);
                    self.emit_arith(Opcode::Mul, CR_REG, r, CR_REG);
                }
                ILStatement::Div { var } => {
                    let r = self.get_var_reg(var);
                    self.emit_arith(Opcode::Div, CR_REG, r, CR_REG);
                }
                ILStatement::Cmp { op, var } => {
                    let r = self.get_var_reg(var);
                    let opcode = match op {
                        CompareOp::Eq => Opcode::Eq,
                        CompareOp::Ne => Opcode::Neq,
                        CompareOp::Gt => Opcode::Gt,
                        CompareOp::Ge => Opcode::Gte,
                        CompareOp::Lt => Opcode::Lt,
                        CompareOp::Le => Opcode::Lte,
                    };
                    self.emit_cmp(opcode, CR_REG, r);
                    self.materialize_cr_from_flags();
                }
                ILStatement::Jump { label } => {
                    let idx = self.current_ip();
                    self.emit_jump(0);
                    self.label_refs.push((idx, label.clone()));
                }
                ILStatement::JumpIf { label } => {
                    self.emit_bool_test_and_jump(label, false);
                }
                ILStatement::JumpIfNot { label } => {
                    self.emit_bool_test_and_jump(label, true);
                }
                ILStatement::Call { fb } => {
                    // ponytail: Call maps to Jump to a label for the FB
                    // FB body handles its own RET
                    let idx = self.current_ip();
                    self.emit(Instruction::call(0));
                    self.label_refs.push((idx, fb.clone()));
                }
                ILStatement::Return => {
                    self.emit(Instruction::ret(None));
                }
            }
        }

        // Halt at end
        self.emit(Instruction::halt());

        // Backpatch labels
        let mut result = self.instructions;
        let halt_ip = (result.len() - 1) as u32; // Halt is last instruction
        for (idx, name) in &self.label_refs {
            let target = self.labels.get(name).copied().unwrap_or(halt_ip as usize);
            let inst = &result[*idx];
            if inst.operands.len() >= 1 {
                result[*idx] = match inst.opcode {
                    Opcode::Jump => Instruction::jump(target as u32),
                    Opcode::JumpIf => Instruction::jump_if(target as u32),
                    Opcode::Call => Instruction::call(target as u32),
                    _ => inst.clone(),
                };
            }
        }

        result
    }
}

pub fn compile_ast(stmts: &[ILStatement]) -> Vec<Instruction> {
    Codegen::new().compile(stmts)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lexer::tokenize;
    use crate::parser::parse;

    #[test]
    fn test_load_and_store_generates_instructions() {
        let tokens = tokenize("LD X1\nST Y1");
        let stmts = parse(&tokens);
        let insts = compile_ast(&stmts);
        // TRUE init, Load, Store, Halt = 4 instructions
        assert_eq!(insts.len(), 4);
        assert_eq!(insts[0].opcode, Opcode::Load); // TRUE init
        assert_eq!(insts[1].opcode, Opcode::Load); // LD X1
        assert_eq!(insts[2].opcode, Opcode::Load); // ST Y1
        assert_eq!(insts[3].opcode, Opcode::Halt);
    }

    #[test]
    fn test_compare_generates_materialize() {
        let tokens = tokenize("LD X1\nGT X2");
        let stmts = parse(&tokens);
        let insts = compile_ast(&stmts);
        assert!(insts.len() > 3);
        // Should contain Gt
        assert!(insts.iter().any(|i| i.opcode == Opcode::Gt));
        // Should contain JumpIf for materialization
        assert!(insts.iter().any(|i| i.opcode == Opcode::JumpIf));
    }

    #[test]
    fn test_label_and_jump_backpatch() {
        let tokens = tokenize("JMP done\nLD X1\ndone: ST Y1");
        let stmts = parse(&tokens);
        let insts = compile_ast(&stmts);
        assert!(insts.iter().any(|i| i.opcode == Opcode::Jump));
        assert!(insts.iter().any(|i| i.opcode == Opcode::Halt));
        // Jump should be patched to a valid index
        let jump = insts.iter().find(|i| i.opcode == Opcode::Jump).unwrap();
        if let Operand::Immediate(HalValue::U32(target)) = &jump.operands[0] {
            assert!(*target > 0, "jump target should be > 0");
        } else {
            panic!("jump should have U32 immediate target");
        }
    }

    #[test]
    fn test_jump_if_generates_cmp_and_jumpif() {
        let tokens = tokenize("LD X1\nJMPC label\nlabel: ST Y1");
        let stmts = parse(&tokens);
        let insts = compile_ast(&stmts);
        // Should have Eq and JumpIf
        assert!(insts.iter().any(|i| i.opcode == Opcode::Eq));
        assert!(insts.iter().any(|i| i.opcode == Opcode::JumpIf));
    }
}
