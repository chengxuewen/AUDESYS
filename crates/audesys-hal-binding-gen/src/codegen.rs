use std::collections::HashMap;

use audesys_hal_core::HalValue;
use audesys_hal_ir::{
    instruction::{Instruction, Opcode},
    program::HalProgram,
    types::{Direction, Operand, SignalBinding},
};

use crate::parser::{BinOp, Expr, Program, Statement, UnaryOp, Variable};

/// r14 and r15 are scratch, r13 is overflow scratch for nested expressions.
const SCRATCH0: u8 = 14;
const SCRATCH1: u8 = 15;
const SCRATCH2: u8 = 13;
const MAX_VAR_REGS: u8 = 13;

#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum CodegenError {
    #[error("undefined variable '{0}'")]
    UndefinedVariable(String),
    #[error("too many variables (max {0})")]
    TooManyVariables(usize),
}

struct Codegen {
    registers: HashMap<String, u8>,
    instructions: Vec<Instruction>,
    scratch_avail: [bool; 3],
    // ponytail: stack of loop exit labels for EXIT; full label stack if needed for nested loops
    loop_exits: Vec<Vec<u32>>,
}

impl Codegen {
    fn new(variables: &[Variable]) -> Result<Self, CodegenError> {
        if variables.len() > MAX_VAR_REGS as usize {
            return Err(CodegenError::TooManyVariables(MAX_VAR_REGS as usize));
        }
        let mut registers = HashMap::new();
        for (i, var) in variables.iter().enumerate() {
            registers.insert(var.name.clone(), i as u8);
        }
        Ok(Codegen {
            registers,
            instructions: Vec::new(),
            scratch_avail: [true, true, true],
            loop_exits: Vec::new(),
        })
    }

    fn push_loop(&mut self) {
        self.loop_exits.push(Vec::new());
    }

    fn record_exit(&mut self) {
        let jmp = self.emit(Instruction::jump(0));
        self.loop_exits.last_mut().unwrap().push(jmp);
    }

    fn pop_loop(&mut self) {
        if let Some(exits) = self.loop_exits.pop() {
            let exit_label = self.current_idx();
            for j in &exits {
                self.patch_jump(*j, exit_label);
            }
        }
    }

    fn alloc_scratch(&mut self) -> u8 {
        for (i, avail) in self.scratch_avail.iter_mut().enumerate() {
            if *avail {
                *avail = false;
                return match i {
                    0 => SCRATCH0,
                    1 => SCRATCH1,
                    2 => SCRATCH2,
                    _ => unreachable!(),
                };
            }
        }
        panic!("scratch overflow: r13/r14/r15 all in use")
    }

    fn free_scratch(&mut self, reg: u8) {
        if reg == SCRATCH0 {
            self.scratch_avail[0] = true;
        }
        if reg == SCRATCH1 {
            self.scratch_avail[1] = true;
        }
        if reg == SCRATCH2 {
            self.scratch_avail[2] = true;
        }
    }

    fn var_reg(&self, name: &str) -> Result<u8, CodegenError> {
        self.registers
            .get(name)
            .copied()
            .ok_or_else(|| CodegenError::UndefinedVariable(name.to_string()))
    }

    fn emit(&mut self, inst: Instruction) -> u32 {
        let idx = self.instructions.len() as u32;
        self.instructions.push(inst);
        idx
    }

    fn current_idx(&self) -> u32 {
        self.instructions.len() as u32
    }

    fn patch_jump(&mut self, inst_idx: u32, target: u32) {
        if let Some(inst) = self.instructions.get_mut(inst_idx as usize) {
            inst.operands = vec![Operand::Immediate(HalValue::U32(target))];
        }
    }

    fn compile_expr(&mut self, expr: &Expr, dest_reg: u8) -> Result<u8, CodegenError> {
        match expr {
            Expr::IntLiteral(n) => {
                self.emit(Instruction::load_imm(dest_reg, HalValue::S32(*n as i32)));
            }
            Expr::RealLiteral(n) => {
                self.emit(Instruction::load_imm(dest_reg, HalValue::F32(*n as f32)));
            }
            Expr::BoolLiteral(b) => {
                self.emit(Instruction::load_imm(dest_reg, HalValue::Bool(*b)));
            }
            Expr::Variable(name) => {
                let src_reg = self.var_reg(name)?;
                // ponytail: load_imm(dest,0)+Add(src,dest,dest) avoids scratch
                if src_reg != dest_reg {
                    self.emit(Instruction::load_imm(dest_reg, HalValue::S32(0)));
                    self.emit(Instruction::arith(Opcode::Add, src_reg, dest_reg, dest_reg));
                }
            }
            Expr::Binary(left, op, right) => {
                if let Some(arith_op) = op_to_arith_opcode(*op) {
                    self.compile_expr(left, dest_reg)?;
                    let s = self.alloc_scratch();
                    self.compile_expr(right, s)?;
                    self.emit(Instruction::arith(arith_op, dest_reg, s, dest_reg));
                    self.free_scratch(s);
                } else if is_cmp_op(*op) {
                    self.compile_cmp_expr(left, *op, right, dest_reg)?;
                } else {
                    let s = self.alloc_scratch();
                    self.compile_expr(left, dest_reg)?;
                    self.compile_expr(right, s)?;
                    let bit_op = match op {
                        BinOp::And => Opcode::And,
                        BinOp::Or => Opcode::Or,
                        BinOp::Xor => Opcode::Xor,
                        _ => unreachable!(),
                    };
                    self.emit(Instruction::arith(bit_op, dest_reg, s, dest_reg));
                    self.free_scratch(s);
                }
            }
            Expr::Unary(UnaryOp::Neg, inner) => {
                self.compile_expr(inner, dest_reg)?;
                let zero = self.alloc_scratch();
                self.emit(Instruction::load_imm(zero, HalValue::S32(0)));
                self.emit(Instruction::arith(Opcode::Sub, zero, dest_reg, dest_reg));
                self.free_scratch(zero);
            }
            Expr::Unary(UnaryOp::Not, inner) => {
                self.compile_expr(inner, dest_reg)?;
                self.emit(Instruction::arith(Opcode::Not, dest_reg, dest_reg, dest_reg));
            }
        }
        Ok(dest_reg)
    }

    fn compile_cmp_expr(
        &mut self,
        left: &Expr,
        op: BinOp,
        right: &Expr,
        dest_reg: u8,
    ) -> Result<(), CodegenError> {
        let rs = self.alloc_scratch();
        self.compile_expr(right, rs)?;
        let ls = self.alloc_scratch();
        self.compile_expr(left, ls)?;
        self.emit(Instruction::cmp(cmp_opcode(op), ls, rs));
        self.free_scratch(ls);
        self.free_scratch(rs);

        self.emit(Instruction::load_imm(dest_reg, HalValue::Bool(false)));
        let jmp = self.emit(Instruction::jump_if(0));
        self.emit(Instruction::load_imm(dest_reg, HalValue::Bool(true)));
        self.patch_jump(jmp, self.current_idx());
        Ok(())
    }

    fn compile_stmt(&mut self, stmt: &Statement) -> Result<(), CodegenError> {
        match stmt {
            Statement::Assign { name, value } => {
                let dest_reg = self.var_reg(name)?;
                self.compile_expr(value, dest_reg)?;
                // ponytail: store result as named signal; full binding resolution in Phase 2
                self.emit(Instruction::new(
                    Opcode::Store,
                    vec![Operand::SignalName(name.clone()), Operand::Register(dest_reg)],
                ));
            }
            Statement::If { condition, then_body, else_body } => {
                let (else_jumps, end_jumps) = self.compile_condition(condition)?;
                // else_jumps: JumpIf when condition is TRUE
                // TRUE → jump to then_body; FALSE → fall through to else
                let to_else = self.emit(Instruction::jump(0));

                // Then body (TRUE path)
                let then_label = self.current_idx();
                for &j in &else_jumps {
                    self.patch_jump(j, then_label);
                }
                for &j in &end_jumps {
                    self.patch_jump(j, then_label);
                }
                for stmt in then_body {
                    self.compile_stmt(stmt)?;
                }
                let to_end = self.emit(Instruction::jump(0));

                // Else body (FALSE path)
                let else_label = self.current_idx();
                self.patch_jump(to_else, else_label);
                for stmt in else_body {
                    self.compile_stmt(stmt)?;
                }

                let end_label = self.current_idx();
                self.patch_jump(to_end, end_label);
            }
            Statement::While { condition, body } => {
                self.push_loop();
                let loop_start = self.current_idx();
                let (else_jumps, _end_jumps) = self.compile_condition(condition)?;
                let exit_jump = self.emit(Instruction::jump(0));
                let body_label = self.current_idx();
                for &j in &else_jumps {
                    self.patch_jump(j, body_label);
                }
                for stmt in body {
                    self.compile_stmt(stmt)?;
                }
                self.emit(Instruction::jump(loop_start));
                let exit_label = self.current_idx();
                self.patch_jump(exit_jump, exit_label);
                self.pop_loop();
            }
            Statement::For { variable, start, end, step, body } => {
                let var_reg = self.var_reg(variable)?;
                self.compile_expr(start, var_reg)?;
                self.push_loop();
                let loop_start = self.current_idx();
                let end_scratch = self.alloc_scratch();
                self.compile_expr(end, end_scratch)?;
                self.emit(Instruction::cmp(Opcode::Gt, var_reg, end_scratch));
                self.free_scratch(end_scratch);
                let exit_jump = self.emit(Instruction::jump_if(0));
                for stmt in body {
                    self.compile_stmt(stmt)?;
                }
                let step_scratch = self.alloc_scratch();
                if let Some(step_expr) = step {
                    self.compile_expr(step_expr, step_scratch)?;
                } else {
                    self.emit(Instruction::load_imm(step_scratch, HalValue::S32(1)));
                }
                self.emit(Instruction::arith(Opcode::Add, var_reg, step_scratch, var_reg));
                self.free_scratch(step_scratch);
                self.emit(Instruction::jump(loop_start));
                let exit_label = self.current_idx();
                self.patch_jump(exit_jump, exit_label);
                self.pop_loop();
            }
            Statement::Repeat { body, condition } => {
                self.push_loop();
                let loop_start = self.current_idx();
                for stmt in body {
                    self.compile_stmt(stmt)?;
                }
                // UNTIL condition: TRUE → exit, FALSE → loop back
                // compile_condition: else_jumps jump when condition is TRUE
                // TRUE → patch else_jumps to exit; FALSE → fall through to jump(loop_start)
                let (else_jumps, _end_jumps) = self.compile_condition(condition)?;
                let to_loop = self.emit(Instruction::jump(0));
                let exit_label = self.current_idx();
                for &j in &else_jumps {
                    self.patch_jump(j, exit_label);
                }
                self.patch_jump(to_loop, loop_start);
                self.pop_loop();
            }
            Statement::Return => {
                self.emit(Instruction::halt());
            }
            Statement::Exit => {
                self.record_exit();
            }
            Statement::Case { variable, cases, else_body } => {
                let var_reg = self.var_reg(variable)?;
                let mut exit_jumps: Vec<u32> = Vec::new();

                for (values, body) in cases {
                    // emit compare chain: CMP(Eq) + JumpIf for each value
                    let mut jump_to_body: Vec<u32> = Vec::new();
                    for val in values {
                        let val_scratch = self.alloc_scratch();
                        self.emit(Instruction::load_imm(val_scratch, HalValue::S32(*val as i32)));
                        self.emit(Instruction::cmp(Opcode::Eq, var_reg, val_scratch));
                        self.free_scratch(val_scratch);
                        jump_to_body.push(self.emit(Instruction::jump_if(0)));
                    }
                    // no match → skip this body
                    let skip_body = self.emit(Instruction::jump(0));

                    // compile body inline (patch JumpIf targets here)
                    let body_label = self.current_idx();
                    for j in &jump_to_body {
                        self.patch_jump(*j, body_label);
                    }
                    for stmt in body {
                        self.compile_stmt(stmt)?;
                    }
                    exit_jumps.push(self.emit(Instruction::jump(0)));

                    // next case comparison starts here
                    let next_case_label = self.current_idx();
                    self.patch_jump(skip_body, next_case_label);
                }

                // Else body
                for stmt in else_body {
                    self.compile_stmt(stmt)?;
                }

                let exit_label = self.current_idx();
                for j in &exit_jumps {
                    self.patch_jump(*j, exit_label);
                }
            }
            Statement::FunCall { name: _name, args } => {
                // ponytail: place args in r0..rN, Call to function address
                // function table resolution deferred to Phase 2
                for (i, arg) in args.iter().enumerate() {
                    if i < 4 {
                        self.compile_expr(arg, i as u8)?;
                    }
                    // ponytail: extra args (>4) deferred to Phase 2 stack ABI
                }
                // ponytail: placeholder Call(0), patched in finalize when function table known
                self.emit(Instruction::call(0));
            }
        }
        Ok(())
    }

    fn compile_condition(&mut self, expr: &Expr) -> Result<(Vec<u32>, Vec<u32>), CodegenError> {
        let mut else_jumps = Vec::new();
        let mut end_jumps = Vec::new();
        self.compile_bool_cond(expr, &mut else_jumps, &mut end_jumps)?;
        Ok((else_jumps, end_jumps))
    }

    fn compile_bool_cond(
        &mut self,
        expr: &Expr,
        else_jumps: &mut Vec<u32>,
        end_jumps: &mut Vec<u32>,
    ) -> Result<(), CodegenError> {
        match expr {
            Expr::Binary(left, op, right) if is_cmp_op(*op) => {
                let rs = self.alloc_scratch();
                self.compile_expr(right, rs)?;
                let ls = self.alloc_scratch();
                self.compile_expr(left, ls)?;
                self.emit(Instruction::cmp(cmp_opcode(*op), ls, rs));
                self.free_scratch(ls);
                self.free_scratch(rs);
                else_jumps.push(self.emit(Instruction::jump_if(0)));
            }
            Expr::Binary(left, BinOp::And, right) => {
                self.compile_bool_cond(left, else_jumps, end_jumps)?;
                self.compile_bool_cond(right, else_jumps, end_jumps)?;
            }
            Expr::Binary(left, BinOp::Or, right) => {
                let mut right_else = Vec::new();
                self.compile_bool_cond(left, &mut right_else, end_jumps)?;
                let or_then = self.emit(Instruction::jump(0));
                end_jumps.push(or_then);
                let right_start = self.current_idx();
                for &j in &right_else {
                    self.patch_jump(j, right_start);
                }
                self.compile_bool_cond(right, else_jumps, end_jumps)?;
            }
            Expr::Unary(UnaryOp::Not, inner) => {
                let mut inner_else = Vec::new();
                let mut inner_end = Vec::new();
                self.compile_bool_cond(inner, &mut inner_else, &mut inner_end)?;
                else_jumps.extend(inner_end);
                end_jumps.extend(inner_else);
            }
            _ => {
                let s = self.alloc_scratch();
                self.compile_expr(expr, s)?;
                let t = self.alloc_scratch();
                self.emit(Instruction::load_imm(t, HalValue::Bool(true)));
                self.emit(Instruction::cmp(Opcode::Eq, s, t));
                self.free_scratch(s);
                self.free_scratch(t);
                else_jumps.push(self.emit(Instruction::jump_if(0)));
            }
        }
        Ok(())
    }

    fn finalize(mut self) -> HalProgram {
        self.emit(Instruction::halt());
        HalProgram::new("", self.instructions)
    }
}

fn is_cmp_op(op: BinOp) -> bool {
    matches!(op, BinOp::Eq | BinOp::Neq | BinOp::Gt | BinOp::Lt | BinOp::Gte | BinOp::Lte)
}

fn cmp_opcode(op: BinOp) -> Opcode {
    match op {
        BinOp::Eq => Opcode::Eq,
        BinOp::Neq => Opcode::Neq,
        BinOp::Gt => Opcode::Gt,
        BinOp::Lt => Opcode::Lt,
        BinOp::Gte => Opcode::Gte,
        BinOp::Lte => Opcode::Lte,
        _ => panic!("not a comparison operator"),
    }
}

fn op_to_arith_opcode(op: BinOp) -> Option<Opcode> {
    match op {
        BinOp::Add => Some(Opcode::Add),
        BinOp::Sub => Some(Opcode::Sub),
        BinOp::Mul => Some(Opcode::Mul),
        BinOp::Div => Some(Opcode::Div),
        BinOp::Mod => Some(Opcode::Mod),
        _ => None,
    }
}

pub fn compile_ast(program: &Program) -> Result<HalProgram, CodegenError> {
    let mut cg = Codegen::new(&program.variables)?;
    for stmt in &program.body {
        cg.compile_stmt(stmt)?;
    }
    let mut result = cg.finalize();
    result.name = program.name.clone();

    // ponytail: extract signal bindings from Store instructions
    // full AT %IW/%QW mapping deferred to Phase 2
    let mut seen = std::collections::HashSet::new();
    for inst in &result.instructions {
        if inst.opcode == Opcode::Store
            && let Some(Operand::SignalName(name)) = inst.operands.first()
            && seen.insert(name.clone())
        {
            result.signals.push(SignalBinding {
                hal_signal_name: name.clone(),
                program_var: name.clone(),
                direction: Direction::Write,
            });
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::{Statement, VarType};

    #[test]
    fn test_compile_empty_program() {
        let prog = Program { name: "empty".into(), variables: vec![], body: vec![] };
        let result = compile_ast(&prog).unwrap();
        assert_eq!(result.name, "empty");
        assert!(result.is_well_formed());
        assert_eq!(result.instructions.len(), 1);
    }

    #[test]
    fn test_simple_assignment() {
        let prog = Program {
            name: "test".into(),
            variables: vec![Variable { name: "x".into(), var_type: VarType::Int }],
            body: vec![Statement::Assign { name: "x".into(), value: Expr::IntLiteral(42) }],
        };
        let result = compile_ast(&prog).unwrap();
        assert!(result.is_well_formed());
        let loads: Vec<_> =
            result.instructions.iter().filter(|i| i.opcode == Opcode::Load).collect();
        assert!(!loads.is_empty());
    }

    #[test]
    fn test_arithmetic() {
        let prog = Program {
            name: "arith".into(),
            variables: vec![
                Variable { name: "a".into(), var_type: VarType::Int },
                Variable { name: "b".into(), var_type: VarType::Int },
                Variable { name: "c".into(), var_type: VarType::Int },
            ],
            body: vec![Statement::Assign {
                name: "c".into(),
                value: Expr::binary(
                    Expr::Variable("a".into()),
                    BinOp::Add,
                    Expr::Variable("b".into()),
                ),
            }],
        };
        let result = compile_ast(&prog).unwrap();
        assert!(result.is_well_formed());
        assert!(result.instructions.iter().any(|i| i.opcode == Opcode::Add));
    }

    #[test]
    fn test_undef_variable_error() {
        let prog = Program {
            name: "err".into(),
            variables: vec![],
            body: vec![Statement::Assign { name: "x".into(), value: Expr::IntLiteral(1) }],
        };
        assert!(compile_ast(&prog).is_err());
    }

    #[test]
    fn test_too_many_variables() {
        let vars: Vec<_> =
            (0..15).map(|i| Variable { name: format!("v{i}"), var_type: VarType::Int }).collect();
        let prog = Program { name: "big".into(), variables: vars, body: vec![] };
        assert!(compile_ast(&prog).is_err());
    }
}
