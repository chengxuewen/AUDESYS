//! Codegen — LD AST → IL text.
//!
//! Maps ladder diagram contacts and coils to IL instructions:
//!   first contact in network  → LD   (or LDN for NC)
//!   subsequent contacts       → AND  (or ANDN for NC)
//!   OUT coil                  → ST
//!   SET coil                  → S
//!   RESET coil                → R

/// Represents a parsed line in a network.
#[derive(Debug, Clone, PartialEq)]
pub enum LdElement {
    Contact { normally_open: bool, var: String },
    Coil { kind: CoilKind, var: String },
}

#[derive(Debug, Clone, PartialEq)]
pub enum CoilKind {
    Out,
    Set,
    Reset,
}

/// Parse a flat token list into a grouped network structure.
/// Each `NETWORK` token starts a new network; contacts and coils
/// belong to the most recently started network.
pub fn parse_networks(tokens: &[super::lexer::Token]) -> Vec<Vec<LdElement>> {
    let mut networks: Vec<Vec<LdElement>> = Vec::new();
    let mut current: Vec<LdElement> = Vec::new();

    for token in tokens {
        match token {
            super::lexer::Token::Network => {
                if !current.is_empty() {
                    networks.push(std::mem::take(&mut current));
                }
            }
            super::lexer::Token::No(var) => {
                current.push(LdElement::Contact { normally_open: true, var: var.clone() });
            }
            super::lexer::Token::Nc(var) => {
                current.push(LdElement::Contact { normally_open: false, var: var.clone() });
            }
            super::lexer::Token::Out(var) => {
                current.push(LdElement::Coil { kind: CoilKind::Out, var: var.clone() });
            }
            super::lexer::Token::Set(var) => {
                current.push(LdElement::Coil { kind: CoilKind::Set, var: var.clone() });
            }
            super::lexer::Token::Reset(var) => {
                current.push(LdElement::Coil { kind: CoilKind::Reset, var: var.clone() });
            }
        }
    }
    if !current.is_empty() {
        networks.push(current);
    }
    networks
}

/// Generate IL text from parsed networks.
///
/// For each network:
/// - First contact: `LD var` (NO) or `LDN var` (NC)
/// - Subsequent contacts: `AND var` or `ANDN var`
/// - Coils: `ST var`, `S var`, or `R var`
pub fn generate_il(networks: &[Vec<LdElement>]) -> String {
    let mut lines: Vec<String> = Vec::new();

    for network in networks {
        let mut first_contact = true;

        for element in network {
            match element {
                LdElement::Contact { normally_open, var } => {
                    if first_contact {
                        if *normally_open {
                            lines.push(format!("LD {}", var));
                        } else {
                            lines.push(format!("LDN {}", var));
                        }
                        first_contact = false;
                    } else {
                        if *normally_open {
                            lines.push(format!("AND {}", var));
                        } else {
                            lines.push(format!("ANDN {}", var));
                        }
                    }
                }
                LdElement::Coil { kind, var } => match kind {
                    CoilKind::Out => lines.push(format!("ST {}", var)),
                    CoilKind::Set => lines.push(format!("S {}", var)),
                    CoilKind::Reset => lines.push(format!("R {}", var)),
                },
            }
        }
    }

    // Join with newlines, no trailing newline at end
    lines.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lexer::tokenize;

    #[test]
    fn test_parse_single_network() {
        let tokens = tokenize("NETWORK\n  NO X1\n  NO X2\n  OUT Y1");
        let networks = parse_networks(&tokens);
        assert_eq!(networks.len(), 1);
        let net = &networks[0];
        assert_eq!(net.len(), 3); // NO, NO, OUT (Network element filtered)
        assert!(
            matches!(net[0], LdElement::Contact { normally_open: true, ref var } if var == "X1")
        );
    }

    #[test]
    fn test_parse_multiple_networks() {
        let tokens = tokenize("NETWORK\n  NO X1\n  OUT Y1\nNETWORK\n  NC X2\n  OUT Y2");
        let networks = parse_networks(&tokens);
        assert_eq!(networks.len(), 2);
    }

    #[test]
    fn test_generate_simple_il() {
        let tokens = tokenize("NETWORK\n  NO X1\n  NO X2\n  OUT Y1");
        let networks = parse_networks(&tokens);
        let il = generate_il(&networks);
        assert_eq!(il, "LD X1\nAND X2\nST Y1");
    }

    #[test]
    fn test_generate_nc_contact() {
        let tokens = tokenize("NETWORK\n  NO X1\n  NC X2\n  OUT Y1");
        let networks = parse_networks(&tokens);
        let il = generate_il(&networks);
        assert_eq!(il, "LD X1\nANDN X2\nST Y1");
    }

    #[test]
    fn test_generate_first_nc() {
        let tokens = tokenize("NETWORK\n  NC X1\n  OUT Y1");
        let networks = parse_networks(&tokens);
        let il = generate_il(&networks);
        assert_eq!(il, "LDN X1\nST Y1");
    }

    #[test]
    fn test_generate_set_reset() {
        let tokens = tokenize("NETWORK\n  NO X1\n  SET Y1\n  NETWORK\n  NO X2\n  RESET Y1");
        let networks = parse_networks(&tokens);
        let il = generate_il(&networks);
        assert_eq!(il, "LD X1\nS Y1\nLD X2\nR Y1");
    }

    #[test]
    fn test_empty_source() {
        let tokens = tokenize("");
        let networks = parse_networks(&tokens);
        let il = generate_il(&networks);
        assert!(il.is_empty());
    }

    #[test]
    fn test_multiple_networks_output() {
        let tokens = tokenize("NETWORK\n  NO X1\n  OUT Y1\nNETWORK\n  NO X2\n  OUT Y2");
        let networks = parse_networks(&tokens);
        let il = generate_il(&networks);
        assert_eq!(il, "LD X1\nST Y1\nLD X2\nST Y2");
    }
}
