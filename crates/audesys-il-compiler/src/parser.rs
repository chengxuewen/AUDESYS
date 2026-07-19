//! IL parser — convert token stream to AST.
use crate::lexer::Token;

#[derive(Debug, Clone)]
pub enum CompareOp {
    Eq,
    Ne,
    Gt,
    Ge,
    Lt,
    Le,
}

#[derive(Debug)]
pub enum ILStatement {
    Load { var: String },
    LoadNot { var: String },
    Store { var: String },
    And { var: String },
    AndNot { var: String },
    Or { var: String },
    OrNot { var: String },
    Xor { var: String },
    Add { var: String },
    Sub { var: String },
    Mul { var: String },
    Div { var: String },
    Cmp { op: CompareOp, var: String },
    Jump { label: String },
    JumpIf { label: String },
    JumpIfNot { label: String },
    Call { fb: String },
    Return,
    Label { name: String },
}

pub fn parse(tokens: &[Token]) -> Vec<ILStatement> {
    let mut stmts = Vec::new();
    let mut i = 0;
    while i < tokens.len() {
        match &tokens[i] {
            Token::Ld => {
                i += 1;
                let var = expect_ident(tokens, &mut i);
                stmts.push(ILStatement::Load { var });
            }
            Token::Ldn => {
                i += 1;
                let var = expect_ident(tokens, &mut i);
                stmts.push(ILStatement::LoadNot { var });
            }
            Token::St => {
                i += 1;
                let var = expect_ident(tokens, &mut i);
                stmts.push(ILStatement::Store { var });
            }
            Token::And => {
                i += 1;
                let var = expect_ident(tokens, &mut i);
                stmts.push(ILStatement::And { var });
            }
            Token::Andn => {
                i += 1;
                let var = expect_ident(tokens, &mut i);
                stmts.push(ILStatement::AndNot { var });
            }
            Token::Or => {
                i += 1;
                let var = expect_ident(tokens, &mut i);
                stmts.push(ILStatement::Or { var });
            }
            Token::Orn => {
                i += 1;
                let var = expect_ident(tokens, &mut i);
                stmts.push(ILStatement::OrNot { var });
            }
            Token::Xor => {
                i += 1;
                let var = expect_ident(tokens, &mut i);
                stmts.push(ILStatement::Xor { var });
            }
            Token::Add => {
                i += 1;
                let var = expect_ident(tokens, &mut i);
                stmts.push(ILStatement::Add { var });
            }
            Token::Sub => {
                i += 1;
                let var = expect_ident(tokens, &mut i);
                stmts.push(ILStatement::Sub { var });
            }
            Token::Mul => {
                i += 1;
                let var = expect_ident(tokens, &mut i);
                stmts.push(ILStatement::Mul { var });
            }
            Token::Div => {
                i += 1;
                let var = expect_ident(tokens, &mut i);
                stmts.push(ILStatement::Div { var });
            }
            Token::Gt => {
                i += 1;
                let var = expect_ident(tokens, &mut i);
                stmts.push(ILStatement::Cmp { op: CompareOp::Gt, var });
            }
            Token::Ge => {
                i += 1;
                let var = expect_ident(tokens, &mut i);
                stmts.push(ILStatement::Cmp { op: CompareOp::Ge, var });
            }
            Token::Eq => {
                i += 1;
                let var = expect_ident(tokens, &mut i);
                stmts.push(ILStatement::Cmp { op: CompareOp::Eq, var });
            }
            Token::Ne => {
                i += 1;
                let var = expect_ident(tokens, &mut i);
                stmts.push(ILStatement::Cmp { op: CompareOp::Ne, var });
            }
            Token::Le => {
                i += 1;
                let var = expect_ident(tokens, &mut i);
                stmts.push(ILStatement::Cmp { op: CompareOp::Le, var });
            }
            Token::Lt => {
                i += 1;
                let var = expect_ident(tokens, &mut i);
                stmts.push(ILStatement::Cmp { op: CompareOp::Lt, var });
            }
            Token::Jmp => {
                i += 1;
                let label = expect_ident(tokens, &mut i);
                stmts.push(ILStatement::Jump { label });
            }
            Token::Jmpc => {
                i += 1;
                let label = expect_ident(tokens, &mut i);
                stmts.push(ILStatement::JumpIf { label });
            }
            Token::Jmpcn => {
                i += 1;
                let label = expect_ident(tokens, &mut i);
                stmts.push(ILStatement::JumpIfNot { label });
            }
            Token::Cal => {
                i += 1;
                let fb = expect_ident(tokens, &mut i);
                stmts.push(ILStatement::Call { fb });
            }
            Token::Ret => {
                i += 1;
                stmts.push(ILStatement::Return);
            }
            Token::Label(name) => {
                i += 1;
                stmts.push(ILStatement::Label { name: name.clone() });
            }
            Token::Ident(_) => {
                // Stray identifier, skip
                i += 1;
            }
        }
    }
    stmts
}

fn expect_ident(tokens: &[Token], i: &mut usize) -> String {
    if *i < tokens.len() {
        if let Token::Ident(name) = &tokens[*i] {
            *i += 1;
            return name.clone();
        }
    }
    "?".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lexer::tokenize;

    #[test]
    fn test_parse_load_and_store() {
        let tokens = tokenize("LD X1\nST Y1");
        let stmts = parse(&tokens);
        assert_eq!(stmts.len(), 2);
        assert!(matches!(stmts[0], ILStatement::Load { ref var } if var == "X1"));
        assert!(matches!(stmts[1], ILStatement::Store { ref var } if var == "Y1"));
    }

    #[test]
    fn test_parse_comparison() {
        let tokens = tokenize("LD X1\nGT X2");
        let stmts = parse(&tokens);
        assert_eq!(stmts.len(), 2);
        assert!(matches!(stmts[0], ILStatement::Load { .. }));
        assert!(matches!(stmts[1], ILStatement::Cmp { op: CompareOp::Gt, ref var } if var == "X2"));
    }

    #[test]
    fn test_parse_jumps() {
        let tokens = tokenize("JMP here\nJMPC there\nJMPCN somewhere");
        let stmts = parse(&tokens);
        assert!(matches!(stmts[0], ILStatement::Jump { ref label } if label == "here"));
        assert!(matches!(stmts[1], ILStatement::JumpIf { ref label } if label == "there"));
        assert!(matches!(stmts[2], ILStatement::JumpIfNot { ref label } if label == "somewhere"));
    }

    #[test]
    fn test_parse_label() {
        let tokens = tokenize("start: NOP\nJMP start");
        let stmts = parse(&tokens);
        assert_eq!(stmts.len(), 2);
        assert!(matches!(stmts[0], ILStatement::Label { ref name } if name == "start"));
        assert!(matches!(stmts[1], ILStatement::Jump { ref label } if label == "start"));
    }

    #[test]
    fn test_parse_ret() {
        let tokens = tokenize("RET");
        let stmts = parse(&tokens);
        assert_eq!(stmts.len(), 1);
        assert!(matches!(stmts[0], ILStatement::Return));
    }
}
