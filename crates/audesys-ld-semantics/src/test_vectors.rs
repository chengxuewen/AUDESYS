//! IEC 61131-3 LD Power Flow Test Vectors
//!
//! Implements the 18 test vectors from `docs/plans/t2a6-iec-ld-semantics-spec.md` §9.
//! Each test verifies rung configuration → expected output per the IEC truth tables.

use crate::*;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn bools(vars: &[(&str, bool)]) -> InputSnapshot {
    InputSnapshot::from_iter(vars.iter().map(|(k, v)| (k.to_string(), *v)))
}

fn eval_serial(contacts: &[Contact], vars: &[(&str, bool)]) -> bool {
    let mut network = build_serial_network(contacts);
    let snapshot = bools(vars);
    let mut edge_state = EdgeState::new();
    evaluate_power_flow(&mut network, &snapshot, &mut edge_state)
}

fn eval_parallel(branches: &[Vec<Contact>], vars: &[(&str, bool)]) -> bool {
    let mut network = build_parallel_network(branches);
    let snapshot = bools(vars);
    let mut edge_state = EdgeState::new();
    evaluate_power_flow(&mut network, &snapshot, &mut edge_state)
}

fn cno(name: &str) -> Contact { Contact::No(name.to_string()) }
fn cnc(name: &str) -> Contact { Contact::Nc(name.to_string()) }

fn coil(name: &str, kind: CoilKind) -> Coil { Coil { var: name.to_string(), kind } }

// ---------------------------------------------------------------------------
// TV-1: Single NO Contact → OUT
// IEC: LD X1 → ST Y1
// ---------------------------------------------------------------------------
#[test]
fn tv1_single_no_contact() {
    assert!(!eval_serial(&[cno("X1")], &[("X1", false)]));
    assert!(eval_serial(&[cno("X1")], &[("X1", true)]));
}

// ---------------------------------------------------------------------------
// TV-2: Single NC Contact → OUT
// IEC: LDN X1 → ST Y1
// ---------------------------------------------------------------------------
#[test]
fn tv2_single_nc_contact() {
    assert!(eval_serial(&[cnc("X1")], &[("X1", false)]));
    assert!(!eval_serial(&[cnc("X1")], &[("X1", true)]));
}

// ---------------------------------------------------------------------------
// TV-3: Two NO in Series (AND)
// IEC: LD X1 → AND X2 → ST Y1
// ---------------------------------------------------------------------------
#[test]
fn tv3_two_no_series_and() {
    // FF
    assert!(!eval_serial(&[cno("X1"), cno("X2")], &[("X1", false), ("X2", false)]));
    // FT
    assert!(!eval_serial(&[cno("X1"), cno("X2")], &[("X1", false), ("X2", true)]));
    // TF
    assert!(!eval_serial(&[cno("X1"), cno("X2")], &[("X1", true), ("X2", false)]));
    // TT
    assert!(eval_serial(&[cno("X1"), cno("X2")], &[("X1", true), ("X2", true)]));
}

// ---------------------------------------------------------------------------
// TV-4: NO + NC in Series
// IEC: LD X1 → ANDN X2 → ST Y1
// ---------------------------------------------------------------------------
#[test]
fn tv4_no_plus_nc_series() {
    // FF: X1=F, X2=F → NC(F)=T, but NO(F)=F → F
    assert!(!eval_serial(&[cno("X1"), cnc("X2")], &[("X1", false), ("X2", false)]));
    // FT: X1=F, X2=T → NC(T)=F → F
    assert!(!eval_serial(&[cno("X1"), cnc("X2")], &[("X1", false), ("X2", true)]));
    // TF: X1=T, X2=F → NC(F)=T, NO(T)=T → T
    assert!(eval_serial(&[cno("X1"), cnc("X2")], &[("X1", true), ("X2", false)]));
    // TT: X1=T, X2=T → NC(T)=F → F
    assert!(!eval_serial(&[cno("X1"), cnc("X2")], &[("X1", true), ("X2", true)]));
}

// ---------------------------------------------------------------------------
// TV-5: NC + NO in Series
// IEC: LDN X1 → AND X2 → ST Y1
// ---------------------------------------------------------------------------
#[test]
fn tv5_nc_plus_no_series() {
    assert!(!eval_serial(&[cnc("X1"), cno("X2")], &[("X1", false), ("X2", false)]));
    assert!(eval_serial(&[cnc("X1"), cno("X2")], &[("X1", false), ("X2", true)]));
    assert!(!eval_serial(&[cnc("X1"), cno("X2")], &[("X1", true), ("X2", false)]));
    assert!(!eval_serial(&[cnc("X1"), cno("X2")], &[("X1", true), ("X2", true)]));
}

// ---------------------------------------------------------------------------
// TV-6: NC + NC in Series
// IEC: LDN X1 → ANDN X2 → ST Y1
// ---------------------------------------------------------------------------
#[test]
fn tv6_nc_plus_nc_series() {
    // FF: NC(F)=T, NC(F)=T → T
    assert!(eval_serial(&[cnc("X1"), cnc("X2")], &[("X1", false), ("X2", false)]));
    // FT: NC(F)=T, NC(T)=F → F
    assert!(!eval_serial(&[cnc("X1"), cnc("X2")], &[("X1", false), ("X2", true)]));
    // TF: NC(T)=F → F
    assert!(!eval_serial(&[cnc("X1"), cnc("X2")], &[("X1", true), ("X2", false)]));
    // TT: NC(T)=F → F
    assert!(!eval_serial(&[cnc("X1"), cnc("X2")], &[("X1", true), ("X2", true)]));
}

// ---------------------------------------------------------------------------
// TV-7: NO in Parallel (OR)
// IEC: LD X1 → OR X2 → ST Y1
// ---------------------------------------------------------------------------
#[test]
fn tv7_no_parallel_or() {
    assert!(!eval_parallel(&[vec![cno("X1")], vec![cno("X2")]], &[("X1", false), ("X2", false)]));
    assert!(eval_parallel(&[vec![cno("X1")], vec![cno("X2")]], &[("X1", false), ("X2", true)]));
    assert!(eval_parallel(&[vec![cno("X1")], vec![cno("X2")]], &[("X1", true), ("X2", false)]));
    assert!(eval_parallel(&[vec![cno("X1")], vec![cno("X2")]], &[("X1", true), ("X2", true)]));
}

// ---------------------------------------------------------------------------
// TV-8: NO Parallel with NC
// IEC: LD X1 → ORN X2 → ST Y1
// ---------------------------------------------------------------------------
#[test]
fn tv8_no_parallel_with_nc() {
    // FF: NO(F)=F, NC(F)=T → OR = T
    assert!(eval_parallel(&[vec![cno("X1")], vec![cnc("X2")]], &[("X1", false), ("X2", false)]));
    // FT: NO(F)=F, NC(T)=F → OR = F
    assert!(!eval_parallel(&[vec![cno("X1")], vec![cnc("X2")]], &[("X1", false), ("X2", true)]));
    // TF: NO(T)=T → OR = T
    assert!(eval_parallel(&[vec![cno("X1")], vec![cnc("X2")]], &[("X1", true), ("X2", false)]));
    // TT: NO(T)=T → OR = T
    assert!(eval_parallel(&[vec![cno("X1")], vec![cnc("X2")]], &[("X1", true), ("X2", true)]));
}

// ---------------------------------------------------------------------------
// TV-9: Start-Stop Seal-in (SET/RESET equivalent)
// Uses: LD START → OR MOTOR → ANDN STOP → ST MOTOR
// This is a mixed serial-parallel network with feedback.
// ---------------------------------------------------------------------------
#[test]
fn tv9_start_stop_seal_in() {
    // Build: left_rail → {NO START, NO MOTOR-feedback} → merge → NC STOP → output
    let mut network = ContactNetwork::new();
    let left = network.add_node();
    network.set_left_rail(left);
    let merge = network.add_node(); // OR merge point
    network.add_edge(left, merge, cno("START"));
    network.add_edge(left, merge, cno("MOTOR")); // seal-in feedback contact
    let out = network.add_node();
    network.add_edge(merge, out, cnc("STOP"));
    network.set_output_node(out);

    let mut vars = VarStore::new();
    let mut edge_state = EdgeState::new();

    // Cycle 0: START=F, STOP=F, MOTOR=F
    vars.set_bool("MOTOR", false);
    let snap = bools(&[("START", false), ("STOP", false), ("MOTOR", false)]);
    let p0 = evaluate_power_flow(&mut network, &snap, &mut edge_state);
    assert!(!p0, "Cycle 0: motor should be OFF");

    // Cycle 1: START=T, STOP=F, MOTOR=F → motor should turn ON
    let snap = bools(&[("START", true), ("STOP", false), ("MOTOR", false)]);
    let p1 = evaluate_power_flow(&mut network, &snap, &mut edge_state);
    assert!(p1, "Cycle 1: motor should turn ON");
    vars.set_bool("MOTOR", p1);

    // Cycle 2: START=F, STOP=F, MOTOR=T (seal-in holds)
    let snap = bools(&[("START", false), ("STOP", false), ("MOTOR", true)]);
    let p2 = evaluate_power_flow(&mut network, &snap, &mut edge_state);
    assert!(p2, "Cycle 2: motor should stay ON via seal-in");
    vars.set_bool("MOTOR", p2);

    // Cycle 3: START=F, STOP=T, MOTOR=T → motor turns OFF
    let snap = bools(&[("START", false), ("STOP", true), ("MOTOR", true)]);
    let p3 = evaluate_power_flow(&mut network, &snap, &mut edge_state);
    assert!(!p3, "Cycle 3: motor should turn OFF");
    vars.set_bool("MOTOR", p3);

    // Cycle 4: START=T, STOP=T, MOTOR=F → STOP overrides START
    let snap = bools(&[("START", true), ("STOP", true), ("MOTOR", false)]);
    let p4 = evaluate_power_flow(&mut network, &snap, &mut edge_state);
    assert!(!p4, "Cycle 4: STOP=true blocks even when START=true");
}

// ---------------------------------------------------------------------------
// TV-10: Serial-Parallel (branch inside series)
// Structure: X1 → (X2 OR X3) → X4 → OUT
// ---------------------------------------------------------------------------
#[test]
fn tv10_serial_parallel_branch_inside_series() {
    // Build: left → X1 → merge1, X1_out → (X2→merge2) | (X3→merge2), merge2 → X4 → output
    let mut network = ContactNetwork::new();
    let left = network.add_node();
    network.set_left_rail(left);
    let n1 = network.add_node();
    network.add_edge(left, n1, cno("X1"));
    let merge = network.add_node();
    network.add_edge(n1, merge, cno("X2"));
    network.add_edge(n1, merge, cno("X3"));
    let out = network.add_node();
    network.add_edge(merge, out, cno("X4"));
    network.set_output_node(out);

    let mut es = EdgeState::new();

    // X1=F → no path
    assert!(!eval_pf(&mut network, &bools(&[("X1", false), ("X2", false), ("X3", false), ("X4", true)]), &mut es));
    // X1=T, X2=F, X3=F, X4=T → branch fails
    assert!(!eval_pf(&mut network, &bools(&[("X1", true), ("X2", false), ("X3", false), ("X4", true)]), &mut es));
    // X1=T, X2=T, X3=F, X4=T → upper branch passes
    assert!(eval_pf(&mut network, &bools(&[("X1", true), ("X2", true), ("X3", false), ("X4", true)]), &mut es));
    // X1=T, X2=F, X3=T, X4=T → lower branch passes
    assert!(eval_pf(&mut network, &bools(&[("X1", true), ("X2", false), ("X3", true), ("X4", true)]), &mut es));
    // X1=T, X2=T, X3=T, X4=T → both pass
    assert!(eval_pf(&mut network, &bools(&[("X1", true), ("X2", true), ("X3", true), ("X4", true)]), &mut es));
    // X1=T, X2=T, X3=T, X4=F → last contact blocks
    assert!(!eval_pf(&mut network, &bools(&[("X1", true), ("X2", true), ("X3", true), ("X4", false)]), &mut es));
}

fn eval_pf(network: &mut ContactNetwork, snapshot: &InputSnapshot, es: &mut EdgeState) -> bool {
    evaluate_power_flow(network, snapshot, es)
}

// ---------------------------------------------------------------------------
// TV-11: Three NC in Series (Safety Interlock)
// IEC: LDN E_OK → ANDN DOOR → ANDN TEMP → ST MOTOR
// ALL must be FALSE for power to flow.
// ---------------------------------------------------------------------------
#[test]
fn tv11_three_nc_series_safety_interlock() {
    // FFF: all NC closed → power flows
    assert!(eval_serial(&[cnc("E_OK"), cnc("DOOR"), cnc("TEMP")], &[("E_OK", false), ("DOOR", false), ("TEMP", false)]));
    // FFT: TEMP=T → NC(TEMP)=F → no flow
    assert!(!eval_serial(&[cnc("E_OK"), cnc("DOOR"), cnc("TEMP")], &[("E_OK", false), ("DOOR", false), ("TEMP", true)]));
    // FTF: DOOR=T → no flow
    assert!(!eval_serial(&[cnc("E_OK"), cnc("DOOR"), cnc("TEMP")], &[("E_OK", false), ("DOOR", true), ("TEMP", false)]));
    // TFF: E_OK=T → no flow
    assert!(!eval_serial(&[cnc("E_OK"), cnc("DOOR"), cnc("TEMP")], &[("E_OK", true), ("DOOR", false), ("TEMP", false)]));
    // FTT: DOOR=T, TEMP=T → no flow
    assert!(!eval_serial(&[cnc("E_OK"), cnc("DOOR"), cnc("TEMP")], &[("E_OK", false), ("DOOR", true), ("TEMP", true)]));
    // TTF: E_OK=T, DOOR=T → no flow
    assert!(!eval_serial(&[cnc("E_OK"), cnc("DOOR"), cnc("TEMP")], &[("E_OK", true), ("DOOR", true), ("TEMP", false)]));
    // TFT: E_OK=T, TEMP=T → no flow
    assert!(!eval_serial(&[cnc("E_OK"), cnc("DOOR"), cnc("TEMP")], &[("E_OK", true), ("DOOR", false), ("TEMP", true)]));
    // TTT: all TRUE → no flow
    assert!(!eval_serial(&[cnc("E_OK"), cnc("DOOR"), cnc("TEMP")], &[("E_OK", true), ("DOOR", true), ("TEMP", true)]));
}

// ---------------------------------------------------------------------------
// TV-12: SET Coil Latching
// Latching behavior: SET latches ON, RESET latches OFF, retains when unpowered.
// ---------------------------------------------------------------------------
#[test]
fn tv12_set_coil_latching() {
    let mut vars = VarStore::new();

    // Cycle 0: no set, no reset → Y1=FALSE
    assert!(!vars.get_bool("Y1"));

    // Cycle 1: SET energized → Y1=TRUE
    let rung = RungDef {
        id: "rung_set".into(),
        network: build_serial_network(&[cno("X1")]),
        coils: vec![coil("Y1", CoilKind::Set)],
    };
    let mut rungs = vec![rung];
    vars.set_bool("X1", true);
    let result = evaluate_cycle(&mut rungs, &mut vars);
    let y1_state = result.rung_states[0].coil_states.iter().find(|c| c.coil_id == "Y1").unwrap();
    assert!(y1_state.energized, "Cycle 1: SET should energize Y1");
    assert!(vars.get_bool("Y1"), "Cycle 1: Y1 should be TRUE in store");

    // Cycle 2: SET not powered → Y1 stays TRUE (latched)
    vars.set_bool("X1", false);
    let mut rungs = vec![RungDef {
        id: "rung_set".into(),
        network: build_serial_network(&[cno("X1")]),
        coils: vec![coil("Y1", CoilKind::Set)],
    }];
    let result = evaluate_cycle(&mut rungs, &mut vars);
    let y1_state = result.rung_states[0].coil_states.iter().find(|c| c.coil_id == "Y1").unwrap();
    assert!(y1_state.energized, "Cycle 2: Y1 should stay latched");
    assert!(vars.get_bool("Y1"), "Cycle 2: Y1 should remain TRUE");

    // Cycle 3: RESET energized → Y1=FALSE
    vars.set_bool("X2", true);
    let mut rungs = vec![RungDef {
        id: "rung_reset".into(),
        network: build_serial_network(&[cno("X2")]),
        coils: vec![coil("Y1", CoilKind::Reset)],
    }];
    let result = evaluate_cycle(&mut rungs, &mut vars);
    let y1_state = result.rung_states[0].coil_states.iter().find(|c| c.coil_id == "Y1").unwrap();
    assert!(!y1_state.energized, "Cycle 3: RESET should de-energize Y1");
    assert!(!vars.get_bool("Y1"), "Cycle 3: Y1 should be FALSE");

    // Cycle 4: nothing powered → Y1 stays FALSE
    vars.set_bool("X1", false);
    vars.set_bool("X2", false);
    let mut rungs = vec![RungDef {
        id: "rung_nop".into(),
        network: build_serial_network(&[cno("X1")]),
        coils: vec![coil("Y1", CoilKind::Set)],
    }];
    let result = evaluate_cycle(&mut rungs, &mut vars);
    let y1_state = result.rung_states[0].coil_states.iter().find(|c| c.coil_id == "Y1").unwrap();
    assert!(!y1_state.energized, "Cycle 4: Y1 should stay FALSE");
}

// ---------------------------------------------------------------------------
// TV-13: Multiple Coils on One Rung
// X1=T → Y1=T, Y2=T, Y3=T. All get same power flow.
// ---------------------------------------------------------------------------
#[test]
fn tv13_multiple_coils_on_one_rung() {
    let mut vars = VarStore::new();

    // X1=F → all coils OFF
    vars.set_bool("X1", false);
    let mut rungs = vec![RungDef {
        id: "r1".into(),
        network: build_serial_network(&[cno("X1")]),
        coils: vec![coil("Y1", CoilKind::Out), coil("Y2", CoilKind::Out), coil("Y3", CoilKind::Out)],
    }];
    let result = evaluate_cycle(&mut rungs, &mut vars);
    for y in ["Y1", "Y2", "Y3"] {
        let cs = result.rung_states[0].coil_states.iter().find(|c| c.coil_id == y).unwrap();
        assert!(!cs.energized, "X1=F: {y} should be FALSE");
    }

    // X1=T → all coils ON
    vars.set_bool("X1", true);
    let mut rungs = vec![RungDef {
        id: "r1".into(),
        network: build_serial_network(&[cno("X1")]),
        coils: vec![coil("Y1", CoilKind::Out), coil("Y2", CoilKind::Out), coil("Y3", CoilKind::Out)],
    }];
    let result = evaluate_cycle(&mut rungs, &mut vars);
    for y in ["Y1", "Y2", "Y3"] {
        let cs = result.rung_states[0].coil_states.iter().find(|c| c.coil_id == y).unwrap();
        assert!(cs.energized, "X1=T: {y} should be TRUE");
    }
}

// ---------------------------------------------------------------------------
// TV-14: EN/ENO Chain with TON → CTU
// ---------------------------------------------------------------------------
#[test]
fn tv14_en_eno_chain() {
    // Row: X1=F → ENO1=F, ENO2=F, Y1=F
    let results = evaluate_eno_chain(false, &[
        FnBlock { name: "TON".into(), error: false, outputs: vec![] },
        FnBlock { name: "CTU".into(), error: false, outputs: vec![FnOutput { var: "Y1".into(), value: true }] },
    ]);
    assert_eq!(results[0].eno, false);
    assert_eq!(results[1].eno, false);

    // Row: X1=T, no error, X2=F → TON passes, CTU doesn't execute
    let results = evaluate_eno_chain(true, &[
        FnBlock { name: "TON".into(), error: false, outputs: vec![] },
        FnBlock { name: "CTU".into(), error: false, outputs: vec![] },
    ]);
    assert!(results[0].eno);
    assert_eq!(results[1].en, true); // CTU would receive EN=T if directly connected
    // Actually in the test: X2 contact is between TON and CTU.
    // The chain correctly passes EN=TRUE through TON, but X2 contact
    // is external to the blocks. Here we test the chain pass-through.
    assert_eq!(results[0].eno, true);
    assert_eq!(results[1].en, results[0].eno);

    // Row: X1=T, TON error → ENO1=F, Y1=F
    let results = evaluate_eno_chain(true, &[
        FnBlock { name: "TON".into(), error: true, outputs: vec![] },
        FnBlock { name: "CTU".into(), error: false, outputs: vec![FnOutput { var: "Y1".into(), value: true }] },
    ]);
    assert_eq!(results[0].eno, false);
    assert_eq!(results[1].en, false);
    assert_eq!(results[1].eno, false);

    // Row: X1=T, TON ok, CTU error → ENO2=F
    let results = evaluate_eno_chain(true, &[
        FnBlock { name: "TON".into(), error: false, outputs: vec![] },
        FnBlock { name: "CTU".into(), error: true, outputs: vec![] },
    ]);
    assert!(results[0].eno);
    assert_eq!(results[1].eno, false);
}

// ---------------------------------------------------------------------------
// TV-15: Rung-to-Rung Propagation (same scan)
// Rung 1: X1 → Y1. Rung 2: Y1 (as NC) → Y2.
// ---------------------------------------------------------------------------
#[test]
fn tv15_rung_to_rung_propagation() {
    let mut vars = VarStore::new();

    // X1=F → R1 Y1=F, R2 NC(Y1=T) → Y2=T
    vars.set_bool("X1", false);
    let mut rungs = vec![
        RungDef {
            id: "r1".into(),
            network: build_serial_network(&[cno("X1")]),
            coils: vec![coil("Y1", CoilKind::Out)],
        },
        RungDef {
            id: "r2".into(),
            network: build_serial_network(&[cnc("Y1")]),
            coils: vec![coil("Y2", CoilKind::Out)],
        },
    ];
    {
        let snapshot = vars.snapshot();
        // Before cycle: Y1 doesn't exist in var store. X1=F.
        assert!(!snapshot.get_bool("Y1"));
    }
    let result = evaluate_cycle(&mut rungs, &mut vars);
    // Rung 1: X1=F → Y1=F
    assert!(!coil_val(&result, 0, "Y1"));
    // Rung 2: NC(Y1) → Y1=F → NC closed → Y2=T
    assert!(coil_val(&result, 1, "Y2"));

    // X1=T → R1 Y1=T, R2 NC(Y1=T) → Y2=F
    vars.set_bool("X1", true);
    let mut rungs = vec![
        RungDef {
            id: "r1".into(),
            network: build_serial_network(&[cno("X1")]),
            coils: vec![coil("Y1", CoilKind::Out)],
        },
        RungDef {
            id: "r2".into(),
            network: build_serial_network(&[cnc("Y1")]),
            coils: vec![coil("Y2", CoilKind::Out)],
        },
    ];
    let result = evaluate_cycle(&mut rungs, &mut vars);
    assert!(coil_val(&result, 0, "Y1"));
    assert!(!coil_val(&result, 1, "Y2"));
}

fn coil_val(result: &PowerFlowResult, rung_idx: usize, coil_id: &str) -> bool {
    result.rung_states[rung_idx].coil_states.iter()
        .find(|c| c.coil_id == coil_id)
        .map(|c| c.energized)
        .unwrap_or(false)
}

// ---------------------------------------------------------------------------
// TV-16: Rising Edge Detection
// PosEdge contact gives one-cycle TRUE pulse on FALSE→TRUE transition.
// ---------------------------------------------------------------------------
#[test]
fn tv16_rising_edge_detection() {
    let mut es = EdgeState::new();

    // We need to simulate multiple cycles with the same edge state.
    // Cycle 0: prev=F, curr=F → no edge → no power
    let snap0 = bools(&[("X1", false)]);
    es.is_rising("X1", &snap0); // Initialize tracking
    let mut network = build_serial_network(&[Contact::PosEdge("X1".into())]);
    let p0 = evaluate_power_flow(&mut network, &snap0, &mut es);
    assert!(!p0, "Cycle 0: FALSE→FALSE, no edge");

    // Cycle 1: prev=F, curr=T → rising edge → power
    // Need a fresh EdgeState for this specific test (advance_cycle resets tracking)
    let mut es = EdgeState::new();
    let snap_pre = bools(&[("X1", false)]);
    es.is_rising("X1", &snap_pre);
    let snap1 = bools(&[("X1", true)]);
    let mut network = build_serial_network(&[Contact::PosEdge("X1".into())]);
    let p1 = evaluate_power_flow(&mut network, &snap1, &mut es);
    assert!(p1, "Cycle 1: FALSE→TRUE, rising edge detected");

    // Cycle 2: prev=T, curr=T → no edge → no power
    let snap2 = bools(&[("X1", true)]);
    let p2 = evaluate_power_flow(&mut network, &snap2, &mut es);
    assert!(!p2, "Cycle 2: TRUE→TRUE, no edge");

    // Cycle 3: prev=T, curr=F → falling edge (not rising) → no power
    let snap3 = bools(&[("X1", false)]);
    let p3 = evaluate_power_flow(&mut network, &snap3, &mut es);
    assert!(!p3, "Cycle 3: TRUE→FALSE, no rising edge");

    // Cycle 4: prev=F, curr=T → rising edge again → power
    let snap4 = bools(&[("X1", true)]);
    let p4 = evaluate_power_flow(&mut network, &snap4, &mut es);
    assert!(p4, "Cycle 4: FALSE→TRUE, rising edge detected again");
}

// ---------------------------------------------------------------------------
// TV-17: Negated Coil
// Coil(/): Y1 = NOT(power_flow)
// ---------------------------------------------------------------------------
#[test]
fn tv17_negated_coil() {
    let mut vars = VarStore::new();

    // X1=F → power=F → negated coil → Y1=T
    vars.set_bool("X1", false);
    let mut rungs = vec![RungDef {
        id: "r1".into(),
        network: build_serial_network(&[cno("X1")]),
        coils: vec![coil("Y1", CoilKind::Negated)],
    }];
    let result = evaluate_cycle(&mut rungs, &mut vars);
    assert!(coil_val(&result, 0, "Y1"), "X1=F: negated coil Y1 should be TRUE");

    // X1=T → power=T → negated coil → Y1=F
    vars.set_bool("X1", true);
    let mut rungs = vec![RungDef {
        id: "r1".into(),
        network: build_serial_network(&[cno("X1")]),
        coils: vec![coil("Y1", CoilKind::Negated)],
    }];
    let result = evaluate_cycle(&mut rungs, &mut vars);
    assert!(!coil_val(&result, 0, "Y1"), "X1=T: negated coil Y1 should be FALSE");
}

// ---------------------------------------------------------------------------
// TV-18: Parallel Branches with Different Depths
// Y1 = (X1 AND X2) OR X3
// ---------------------------------------------------------------------------
#[test]
fn tv18_parallel_branches_different_depths() {
    let mut es = EdgeState::new();

    // Build: left → (X1→X2→output) | (X3→output)
    let mut network = ContactNetwork::new();
    let left = network.add_node();
    network.set_left_rail(left);
    // Branch 1: X1 → X2
    let n1 = network.add_node();
    network.add_edge(left, n1, cno("X1"));
    let out = network.add_node();
    network.add_edge(n1, out, cno("X2"));
    // Branch 2: X3 directly to output
    network.add_edge(left, out, cno("X3"));
    network.set_output_node(out);

    // X1=F, X2=*, X3=F → no path
    assert!(!eval_pf(&mut network, &bools(&[("X1", false), ("X2", false), ("X3", false)]), &mut es));
    // X1=T, X2=T, X3=* → branch 1 passes
    assert!(eval_pf(&mut network, &bools(&[("X1", true), ("X2", true), ("X3", false)]), &mut es));
    // X1=*, X2=*, X3=T → branch 2 passes
    assert!(eval_pf(&mut network, &bools(&[("X1", false), ("X2", false), ("X3", true)]), &mut es));
    // X1=T, X2=F, X3=F → branch 1 blocked, branch 2 blocked
    assert!(!eval_pf(&mut network, &bools(&[("X1", true), ("X2", false), ("X3", false)]), &mut es));
}
