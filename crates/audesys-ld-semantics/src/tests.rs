//! Unit tests for audesys-ld-semantics core types and functions.

use crate::*;

// ---------------------------------------------------------------------------
// ContactNetwork construction
// ---------------------------------------------------------------------------
#[test]
fn contact_network_empty_returns_false() {
    let mut network = ContactNetwork::new();
    let left = network.add_node();
    network.set_left_rail(left);
    let out = network.add_node();
    network.set_output_node(out);
    // No edges → no power path
    let snap = InputSnapshot::new();
    let mut es = EdgeState::new();
    assert!(!evaluate_power_flow(&mut network, &snap, &mut es));
}

#[test]
fn contact_network_topological_order() {
    let mut network = ContactNetwork::new();
    let a = network.add_node();
    let b = network.add_node();
    let c = network.add_node();
    network.add_edge(a, b, Contact::No("X1".into()));
    network.add_edge(b, c, Contact::No("X2".into()));
    network.set_left_rail(a);
    network.set_output_node(c);
    let topo = network.topological_order();
    // a must come before b, b before c
    let pos_a = topo.iter().position(|&n| n == a).unwrap();
    let pos_b = topo.iter().position(|&n| n == b).unwrap();
    let pos_c = topo.iter().position(|&n| n == c).unwrap();
    assert!(pos_a < pos_b, "a should precede b in topological order");
    assert!(pos_b < pos_c, "b should precede c in topological order");
}

// ---------------------------------------------------------------------------
// Contact truth tables
// ---------------------------------------------------------------------------
#[test]
fn no_contact_passes_when_variable_true() {
    let mut network = ContactNetwork::new();
    let left = network.add_node();
    network.set_left_rail(left);
    let out = network.add_node();
    network.add_edge(left, out, Contact::No("X1".into()));
    network.set_output_node(out);
    let mut es = EdgeState::new();

    assert!(!evaluate_power_flow(&mut network, &bools(&[("X1", false)]), &mut es));
    assert!(evaluate_power_flow(&mut network, &bools(&[("X1", true)]), &mut es));
}

#[test]
fn nc_contact_passes_when_variable_false() {
    let mut network = ContactNetwork::new();
    let left = network.add_node();
    network.set_left_rail(left);
    let out = network.add_node();
    network.add_edge(left, out, Contact::Nc("X1".into()));
    network.set_output_node(out);
    let mut es = EdgeState::new();

    assert!(evaluate_power_flow(&mut network, &bools(&[("X1", false)]), &mut es));
    assert!(!evaluate_power_flow(&mut network, &bools(&[("X1", true)]), &mut es));
}

fn bools(vars: &[(&str, bool)]) -> InputSnapshot {
    InputSnapshot::from_iter(vars.iter().map(|(k, v)| (k.to_string(), *v)))
}

// ---------------------------------------------------------------------------
// EN/ENO
// ---------------------------------------------------------------------------
#[test]
fn eno_false_when_en_false() {
    assert!(!evaluate_eno(false, false));
}

#[test]
fn eno_true_when_en_true_no_error() {
    assert!(evaluate_eno(true, false));
}

#[test]
fn eno_false_when_en_true_with_error() {
    assert!(!evaluate_eno(true, true));
}

#[test]
fn eno_chain_propagates_false_downstream() {
    let results = evaluate_eno_chain(true, &[
        FnBlock { name: "A".into(), error: true, outputs: vec![] },
        FnBlock { name: "B".into(), error: false, outputs: vec![] },
        FnBlock { name: "C".into(), error: false, outputs: vec![] },
    ]);
    assert!(results[0].en, "Block A receives EN=T");
    assert!(!results[0].eno, "Block A error → ENO=F");
    assert!(!results[1].en, "Block B receives EN=F from A's ENO");
    assert!(!results[2].en, "Block C receives EN=F from B's ENO");
}

// ---------------------------------------------------------------------------
// VarStore snapshot
// ---------------------------------------------------------------------------
#[test]
fn var_store_snapshot_captures_current_values() {
    let mut vars = VarStore::new();
    vars.set_bool("A", true);
    vars.set_bool("B", false);
    let snap = vars.snapshot();
    assert!(snap.get_bool("A"));
    assert!(!snap.get_bool("B"));
    assert!(!snap.get_bool("C")); // missing → false
}

// ---------------------------------------------------------------------------
// Coil kind evaluation in evaluate_rung
// ---------------------------------------------------------------------------
#[test]
fn out_coil_follows_power() {
    let mut vars = VarStore::new();
    vars.set_bool("X1", true);
    let mut es = EdgeState::new();
    let snapshot = vars.snapshot();
    let state = evaluate_rung("r1", &[Contact::No("X1".into())], &[Coil { var: "Y1".into(), kind: CoilKind::Out }], &snapshot, &mut es, &vars);
    assert!(state.coil_states[0].energized);
}

#[test]
fn negated_coil_inverts_power() {
    let mut vars = VarStore::new();
    vars.set_bool("X1", false); // no power
    let mut es = EdgeState::new();
    let snapshot = vars.snapshot();
    let state = evaluate_rung("r1", &[Contact::No("X1".into())], &[Coil { var: "Y1".into(), kind: CoilKind::Negated }], &snapshot, &mut es, &vars);
    assert!(state.coil_states[0].energized, "No power → negated coil is energized");
}

// ---------------------------------------------------------------------------
// ContactNetwork serde round-trip
// ---------------------------------------------------------------------------
#[test]
fn contact_type_serde_roundtrip() {
    let ct = Contact::No("X1".into());
    let json = serde_json::to_string(&ct).unwrap();
    let ct2: Contact = serde_json::from_str(&json).unwrap();
    assert_eq!(ct, ct2);
}

#[test]
fn coil_kind_serde_roundtrip() {
    let ck = CoilKind::Set;
    let json = serde_json::to_string(&ck).unwrap();
    let ck2: CoilKind = serde_json::from_str(&json).unwrap();
    assert_eq!(ck, ck2);
}

#[test]
fn power_flow_result_serde_roundtrip() {
    let result = PowerFlowResult {
        rung_states: vec![RungState {
            rung_id: "r1".into(),
            contact_states: vec![ContactState { contact_id: "X1".into(), contact_type: ContactType::No, is_closed: true }],
            coil_states: vec![CoilState { coil_id: "Y1".into(), coil_type: CoilType::Normal, energized: true }],
        }],
        powered_coils: vec!["Y1".into()],
    };
    let json = serde_json::to_string(&result).unwrap();
    let result2: PowerFlowResult = serde_json::from_str(&json).unwrap();
    assert_eq!(result, result2);
}
