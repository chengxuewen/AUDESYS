//! AUDESYS IEC 61131-3 LD Power Flow Semantics
//!
//! Implements power flow evaluation for Ladder Diagram rungs per IEC 61131-3 §4.
//!
//! # Core concepts
//!
//! - **Left power rail** always TRUE (power originates here)
//! - **Contacts** (NO/NC/PosEdge/NegEdge) gate power flow left-to-right
//! - **Serial contacts** = AND logic (all must pass)
//! - **Parallel branches** = OR logic (any branch powers the merge node)
//! - **Coils** (Out/Set/Reset/Negated) consume power flow at the right end
//! - **EN/ENO** pins gate function block execution
//!
//! # Usage
//!
//! ```rust
//! use audesys_ld_semantics::{ContactNetwork, Contact, ContactNode, ContactEdge,
//!     InputSnapshot, EdgeState, evaluate_power_flow};
//!
//! let mut network = ContactNetwork::new();
//! let left = network.add_node();
//! let out = network.add_node();
//! network.add_edge(left, out, Contact::No("X1".into()));
//! network.set_left_rail(left);
//! network.set_output_node(out);
//!
//! let mut edge_state = EdgeState::new();
//! let snapshot = InputSnapshot::from([("X1".into(), true)]);
//! let power = evaluate_power_flow(&mut network, &snapshot, &mut edge_state);
//! assert!(power);
//! ```

use std::collections::HashMap;

// ---------------------------------------------------------------------------
// Node/Edge ID types
// ---------------------------------------------------------------------------

/// Node identifier in a contact network graph.
pub type NodeId = usize;

// ---------------------------------------------------------------------------
// Contact types
// ---------------------------------------------------------------------------

/// A contact element in a rung (IEC 61131-3 §4.2.1).
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum Contact {
    /// Normally Open — variable TRUE → power passes
    No(String),
    /// Normally Closed — variable FALSE → power passes
    Nc(String),
    /// Positive edge detection — FALSE→TRUE transition gives one-cycle TRUE
    PosEdge(String),
    /// Negative edge detection — TRUE→FALSE transition gives one-cycle TRUE
    NegEdge(String),
}

impl Contact {
    /// Returns the variable name bound to this contact.
    pub fn var_name(&self) -> &str {
        match self {
            Contact::No(v) | Contact::Nc(v) | Contact::PosEdge(v) | Contact::NegEdge(v) => v,
        }
    }
}

// ---------------------------------------------------------------------------
// Coil types
// ---------------------------------------------------------------------------

/// Coil kind per IEC 61131-3 §4.2.2.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum CoilKind {
    /// `-( )-` variable = power flow
    Out,
    /// `-(S)-` latch TRUE when powered
    Set,
    /// `-(R)-` latch FALSE when powered
    Reset,
    /// `-(/)-` variable = NOT power flow
    Negated,
}

/// An output coil element.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct Coil {
    /// Variable name
    pub var: String,
    /// Coil kind
    pub kind: CoilKind,
}

// ---------------------------------------------------------------------------
// ContactNetwork DAG
// ---------------------------------------------------------------------------

/// A node (connection point) in the contact network graph.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContactNode {
    /// Node ID
    pub id: NodeId,
}

/// A directed edge in the contact network, carrying a contact element.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContactEdge {
    /// Source node
    pub source: NodeId,
    /// Target node
    pub target: NodeId,
    /// Contact element on this edge
    pub contact: Contact,
}

/// Directed acyclic graph representing a rung's contact network.
///
/// Power flows from `left_rail` through edges (contacts) to `output_node`.
/// Nodes with multiple incoming edges use OR-semantics (any path powers the node).
#[derive(Debug, Clone)]
pub struct ContactNetwork {
    nodes: Vec<ContactNode>,
    edges: Vec<ContactEdge>,
    left_rail: Option<NodeId>,
    output_node: Option<NodeId>,
    /// Pre-computed adjacency list: node → outgoing edge indices
    outgoing: Vec<Vec<usize>>,
    /// Pre-computed topological order (left to right)
    topo_order: Vec<NodeId>,
    /// Whether adj lists need rebuild
    dirty: bool,
}

impl ContactNetwork {
    /// Create an empty contact network.
    pub fn new() -> Self {
        Self {
            nodes: Vec::new(),
            edges: Vec::new(),
            left_rail: None,
            output_node: None,
            outgoing: Vec::new(),
            topo_order: Vec::new(),
            dirty: false,
        }
    }

    /// Add a new node and return its ID.
    pub fn add_node(&mut self) -> NodeId {
        let id = self.nodes.len();
        self.nodes.push(ContactNode { id });
        self.outgoing.push(Vec::new());
        self.dirty = true;
        id
    }

    /// Add a directed edge between two nodes, carrying a contact.
    pub fn add_edge(&mut self, source: NodeId, target: NodeId, contact: Contact) {
        self.edges.push(ContactEdge { source, target, contact });
        let edge_idx = self.edges.len() - 1;
        self.outgoing[source].push(edge_idx);
        self.dirty = true;
    }

    /// Set the left power rail node (power enters here).
    pub fn set_left_rail(&mut self, node: NodeId) {
        self.left_rail = Some(node);
    }

    /// Set the output node (power exits here to coils/FBs).
    pub fn set_output_node(&mut self, node: NodeId) {
        self.output_node = Some(node);
    }

    /// Return the left rail node ID.
    pub fn left_rail_node(&self) -> NodeId {
        self.left_rail.expect("left_rail not set")
    }

    /// Return the output node ID.
    pub fn output_node_id(&self) -> NodeId {
        self.output_node.expect("output_node not set")
    }

    /// Return the edges leaving a node.
    pub fn outgoing_edges(&self, node: NodeId) -> impl Iterator<Item = &ContactEdge> {
        self.outgoing[node].iter().map(|&idx| &self.edges[idx])
    }

    /// Return a topological order (left-to-right). Rebuilds if dirty.
    pub fn topological_order(&mut self) -> &[NodeId] {
        if self.dirty {
            self.rebuild_topo();
        }
        &self.topo_order
    }

    fn rebuild_topo(&mut self) {
        let n = self.nodes.len();
        let mut in_degree = vec![0usize; n];
        for edge in &self.edges {
            in_degree[edge.target] += 1;
        }
        // Seed with left_rail (or all in-degree 0 nodes)
        let mut queue: Vec<NodeId> = if let Some(lr) = self.left_rail {
            vec![lr]
        } else {
            (0..n).filter(|&i| in_degree[i] == 0).collect()
        };
        self.topo_order.clear();
        while let Some(node) = queue.pop() {
            self.topo_order.push(node);
            for &edge_idx in &self.outgoing[node] {
                let target = self.edges[edge_idx].target;
                in_degree[target] = in_degree[target].saturating_sub(1);
                if in_degree[target] == 0 {
                    queue.push(target);
                }
            }
        }
        self.dirty = false;
    }
}

impl Default for ContactNetwork {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Input snapshot
// ---------------------------------------------------------------------------

/// Snapshot of all input variable values for one scan cycle.
/// All contacts in a rung use the same snapshot (IEC 61131-3 §4.1.2).
#[derive(Debug, Clone, Default)]
pub struct InputSnapshot {
    values: HashMap<String, bool>,
}

impl InputSnapshot {
    /// Create a new empty snapshot.
    pub fn new() -> Self {
        Self { values: HashMap::new() }
    }

    /// Set a boolean value.
    pub fn set(&mut self, var: &str, value: bool) {
        self.values.insert(var.to_string(), value);
    }

    /// Get a boolean value. Returns `false` if the variable is not in the snapshot.
    pub fn get_bool(&self, var: &str) -> bool {
        self.values.get(var).copied().unwrap_or(false)
    }
}

impl From<HashMap<String, bool>> for InputSnapshot {
    fn from(values: HashMap<String, bool>) -> Self {
        Self { values }
    }
}

impl<const N: usize> From<[(String, bool); N]> for InputSnapshot {
    fn from(arr: [(String, bool); N]) -> Self {
        Self { values: HashMap::from(arr) }
    }
}

impl FromIterator<(String, bool)> for InputSnapshot {
    fn from_iter<I: IntoIterator<Item = (String, bool)>>(iter: I) -> Self {
        Self { values: HashMap::from_iter(iter) }
    }
}

// ---------------------------------------------------------------------------
// Edge state tracking
// ---------------------------------------------------------------------------

/// Tracks previous-cycle variable values for edge detection (PosEdge/NegEdge).
#[derive(Debug, Clone, Default)]
pub struct EdgeState {
    /// Variable → value from previous scan cycle
    prev: HashMap<String, bool>,
}

impl EdgeState {
    /// Create a new edge state tracker.
    pub fn new() -> Self {
        Self { prev: HashMap::new() }
    }

    /// Returns true if the variable had a rising edge (FALSE→TRUE) in this cycle.
    /// Consumes the snapshot to record values.
    pub fn is_rising(&mut self, var: &str, snapshot: &InputSnapshot) -> bool {
        let curr = snapshot.get_bool(var);
        let prev = self.prev.get(var).copied().unwrap_or(false);
        // Record current for next cycle
        self.prev.insert(var.to_string(), curr);
        // Rising: was FALSE, now TRUE
        !prev && curr
    }

    /// Returns true if the variable had a falling edge (TRUE→FALSE) in this cycle.
    pub fn is_falling(&mut self, var: &str, snapshot: &InputSnapshot) -> bool {
        let curr = snapshot.get_bool(var);
        let prev = self.prev.get(var).copied().unwrap_or(false);
        self.prev.insert(var.to_string(), curr);
        // Falling: was TRUE, now FALSE
        prev && !curr
    }

    /// Advance to next cycle: store current values as previous.
    /// Call this after all rungs of a cycle are evaluated.
    pub fn advance_cycle(&mut self, snapshot: &InputSnapshot) {
        // Already recorded via is_rising/is_falling; but ensure any
        // variables that were not queried as edges still get recorded.
        for (var, val) in &snapshot.values {
            self.prev.entry(var.clone()).or_insert(*val);
        }
    }
}

// ---------------------------------------------------------------------------
// Power flow evaluation
// ---------------------------------------------------------------------------

/// Evaluate power flow through a contact network graph.
///
/// Power originates at the left rail (TRUE) and propagates through the
/// graph via topological traversal. Each contact edge gates the power:
/// - NO: power passes if variable is TRUE
/// - NC: power passes if variable is FALSE
/// - PosEdge: power passes on rising edge (one-cycle pulse)
/// - NegEdge: power passes on falling edge (one-cycle pulse)
///
/// Nodes use OR-semantics: a node is TRUE if ANY incoming path is TRUE.
///
/// Returns the power value at the output node.
pub fn evaluate_power_flow(
    network: &mut ContactNetwork,
    snapshot: &InputSnapshot,
    edge_state: &mut EdgeState,
) -> bool {
    let left_rail = network.left_rail_node();
    let output_node = network.output_node_id();
    let topo = network.topological_order().to_vec();

    // node_power[node] = whether power reaches this node
    let mut node_power: HashMap<NodeId, bool> = HashMap::new();
    node_power.insert(left_rail, true);

    for &node in &topo {
        if let Some(power) = node_power.get(&node).copied() {
            if !power {
                continue; // no power at source → skip outgoing edges
            }
            for edge in network.outgoing_edges(node) {
                let contact_power = match &edge.contact {
                    Contact::No(var) => snapshot.get_bool(var),
                    Contact::Nc(var) => !snapshot.get_bool(var),
                    Contact::PosEdge(var) => edge_state.is_rising(var, snapshot),
                    Contact::NegEdge(var) => edge_state.is_falling(var, snapshot),
                };
                // OR-semantics: if multiple incoming edges converge,
                // the node is TRUE if ANY incoming path carries power
                let existing = node_power.get(&edge.target).copied().unwrap_or(false);
                node_power.insert(edge.target, existing || contact_power);
            }
        }
    }

    node_power.get(&output_node).copied().unwrap_or(false)
}

// ---------------------------------------------------------------------------
// Rung-level types
// ---------------------------------------------------------------------------

/// State of a single contact in a rung result.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct ContactState {
    /// Contact variable identifier
    pub contact_id: String,
    /// Contact type
    pub contact_type: ContactType,
    /// Whether the contact is closed (passes power)
    pub is_closed: bool,
}

/// Simplified contact type for state reporting.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum ContactType {
    /// Normally open
    No,
    /// Normally closed
    Nc,
}

/// State of a coil after evaluation.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct CoilState {
    /// Coil variable identifier
    pub coil_id: String,
    /// Coil type
    pub coil_type: CoilType,
    /// Whether the coil is energized
    pub energized: bool,
}

/// Coil type for state reporting.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum CoilType {
    /// Normal output coil
    Normal,
    /// Negated coil (energized = NOT power)
    Negated,
    /// Set (latch) coil
    Set,
    /// Reset (unlatch) coil
    Reset,
}

/// State of one rung after evaluation.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct RungState {
    /// Rung identifier
    pub rung_id: String,
    /// Contact states in this rung
    pub contact_states: Vec<ContactState>,
    /// Coil states in this rung
    pub coil_states: Vec<CoilState>,
}

/// Result of evaluating all rungs in a POU.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct PowerFlowResult {
    /// Per-rung states
    pub rung_states: Vec<RungState>,
    /// IDs of coils that are powered (energized) after evaluation
    pub powered_coils: Vec<String>,
}

// ---------------------------------------------------------------------------
// Rung evaluation
// ---------------------------------------------------------------------------

/// Evaluate a single rung: contacts → power flow → coils.
///
/// Given a list of contacts (evaluated as a flat serial chain) and a list
/// of coils, computes the resulting RungState.
///
/// For parallel branches, use `evaluate_network` instead with a `ContactNetwork`.
pub fn evaluate_rung(
    rung_id: &str,
    contacts: &[Contact],
    coils: &[Coil],
    snapshot: &InputSnapshot,
    edge_state: &mut EdgeState,
    var_store: &VarStore,
) -> RungState {
    // Build a simple serial network from the contact list
    let mut network = ContactNetwork::new();
    let left = network.add_node();
    network.set_left_rail(left);
    let mut prev = left;
    for contact in contacts {
        let next = network.add_node();
        network.add_edge(prev, next, contact.clone());
        prev = next;
    }
    network.set_output_node(prev);

    let power = evaluate_power_flow(&mut network, snapshot, edge_state);

    let mut contact_states = Vec::new();
    for contact in contacts {
        let (ct, is_closed) = match contact {
            Contact::No(v) => (ContactType::No, snapshot.get_bool(v)),
            Contact::Nc(v) => (ContactType::Nc, !snapshot.get_bool(v)),
            Contact::PosEdge(v) => (ContactType::No, edge_is(v, snapshot, edge_state)),
            Contact::NegEdge(v) => (ContactType::Nc, edge_is(v, snapshot, edge_state)),
        };
        contact_states.push(ContactState { contact_id: contact.var_name().to_string(), contact_type: ct, is_closed });
    }

    let coil_states: Vec<CoilState> = coils.iter().map(|coil| {
        let energized = match coil.kind {
            CoilKind::Out => power,
            CoilKind::Negated => !power,
            CoilKind::Set => power || (var_store.get_bool(&coil.var) && !power),
            CoilKind::Reset => !power && var_store.get_bool(&coil.var),
        };
        let coil_type = match coil.kind {
            CoilKind::Out => CoilType::Normal,
            CoilKind::Negated => CoilType::Negated,
            CoilKind::Set => CoilType::Set,
            CoilKind::Reset => CoilType::Reset,
        };
        CoilState { coil_id: coil.var.clone(), coil_type, energized }
    }).collect();

    RungState { rung_id: rung_id.to_string(), contact_states, coil_states }
}

fn edge_is(var: &str, snapshot: &InputSnapshot, edge_state: &EdgeState) -> bool {
    // We can't call is_rising/is_falling on a shared ref — stub for contact state reporting.
    // Real evaluation goes through evaluate_power_flow which uses &mut EdgeState.
    let _ = (var, snapshot, edge_state);
    snapshot.get_bool(var)
}

// ---------------------------------------------------------------------------
// Variable store (for latching coils across scans)
// ---------------------------------------------------------------------------

/// Variable store for SET/RESET coil latching across scan cycles.
#[derive(Debug, Clone, Default)]
pub struct VarStore {
    values: HashMap<String, bool>,
}

impl VarStore {
    /// Create an empty variable store.
    pub fn new() -> Self {
        Self { values: HashMap::new() }
    }

    /// Get a variable's current value.
    pub fn get_bool(&self, var: &str) -> bool {
        self.values.get(var).copied().unwrap_or(false)
    }

    /// Set a variable's value.
    pub fn set_bool(&mut self, var: &str, value: bool) {
        self.values.insert(var.to_string(), value);
    }

    /// Apply rung evaluation results to the store.
    pub fn apply(&mut self, result: &PowerFlowResult) {
        for rung in &result.rung_states {
            for coil in &rung.coil_states {
                self.values.insert(coil.coil_id.clone(), coil.energized);
            }
        }
    }

    /// Create a snapshot of current values for input scanning.
    pub fn snapshot(&self) -> InputSnapshot {
        InputSnapshot { values: self.values.clone() }
    }
}

// ---------------------------------------------------------------------------
// EN/ENO evaluation
// ---------------------------------------------------------------------------

/// Evaluate EN → ENO for a function block.
///
/// Per IEC 61131-3 §4.2.4:
/// - EN=FALSE → ENO=FALSE, block skipped
/// - EN=TRUE, no error → ENO=TRUE
/// - EN=TRUE, error → ENO=FALSE
///
/// The `error` flag indicates whether the block encountered an error
/// (division by zero, out of range, etc.).
pub fn evaluate_eno(en: bool, error: bool) -> bool {
    en && !error
}

/// Evaluate a chain of function blocks with EN/ENO propagation.
///
/// Each block's ENO becomes the EN of the next block.
/// If any block's ENO is FALSE, downstream blocks are skipped.
pub fn evaluate_eno_chain(
    first_en: bool,
    blocks: &[FnBlock],
) -> Vec<FnBlockResult> {
    let mut results = Vec::new();
    let mut en = first_en;
    for block in blocks {
        let eno = if en && !block.error { true } else { false };
        results.push(FnBlockResult {
            name: block.name.clone(),
            en,
            eno,
            outputs: if en && !block.error { block.outputs.clone() } else { Vec::new() },
        });
        en = eno;
    }
    results
}

/// A function block in an EN/ENO chain.
#[derive(Debug, Clone)]
pub struct FnBlock {
    /// Block instance name
    pub name: String,
    /// Did the block encounter an error?
    pub error: bool,
    /// Output values (only used when block executes successfully)
    pub outputs: Vec<FnOutput>,
}

/// Output value from a function block execution.
#[derive(Debug, Clone)]
pub struct FnOutput {
    /// Variable name
    pub var: String,
    /// Boolean output value
    pub value: bool,
}

/// Result of evaluating one block in an EN/ENO chain.
#[derive(Debug, Clone)]
pub struct FnBlockResult {
    /// Block name
    pub name: String,
    /// EN (enable input) value received
    pub en: bool,
    /// ENO (enable output) value produced
    pub eno: bool,
    /// Output values produced (empty if EN=FALSE or error)
    pub outputs: Vec<FnOutput>,
}

// ---------------------------------------------------------------------------
// Full scan cycle evaluation
// ---------------------------------------------------------------------------

/// A rung definition for evaluation.
#[derive(Debug, Clone)]
pub struct RungDef {
    /// Rung identifier
    pub id: String,
    /// Contact network for this rung
    pub network: ContactNetwork,
    /// Coils on this rung
    pub coils: Vec<Coil>,
}

/// Evaluate all rungs for one scan cycle (IEC 61131-3 §4.1.2).
///
/// Rungs are evaluated top-to-bottom. All contacts use the same input
/// snapshot. A coil written in rung N is visible as a contact in rung N+1.
pub fn evaluate_cycle(
    rungs: &mut [RungDef],
    vars: &mut VarStore,
) -> PowerFlowResult {
    let mut input_snapshot = vars.snapshot();
    let mut edge_state = EdgeState::new();
    let mut rung_states = Vec::new();
    let mut powered_coils = Vec::new();

    for rung in rungs.iter_mut() {
        let power = evaluate_power_flow(&mut rung.network, &input_snapshot, &mut edge_state);

        let contact_states: Vec<ContactState> = rung.network.edges.iter().map(|edge| {
            let (ct, is_closed) = match &edge.contact {
                Contact::No(v) => (ContactType::No, input_snapshot.get_bool(v)),
                Contact::Nc(v) => (ContactType::Nc, !input_snapshot.get_bool(v)),
                // ponytail: edge contacts get approximate state for reporting
                Contact::PosEdge(v) => (ContactType::No, input_snapshot.get_bool(v)),
                Contact::NegEdge(v) => (ContactType::Nc, !input_snapshot.get_bool(v)),
            };
            ContactState { contact_id: edge.contact.var_name().to_string(), contact_type: ct, is_closed }
        }).collect();

        let coil_states: Vec<CoilState> = rung.coils.iter().map(|coil| {
            let energized = match coil.kind {
                CoilKind::Out => power,
                CoilKind::Negated => !power,
                CoilKind::Set => {
                    if power { true } else { vars.get_bool(&coil.var) }
                }
                CoilKind::Reset => {
                    if power { false } else { vars.get_bool(&coil.var) }
                }
            };
            let coil_type = match coil.kind {
                CoilKind::Out => CoilType::Normal,
                CoilKind::Negated => CoilType::Negated,
                CoilKind::Set => CoilType::Set,
                CoilKind::Reset => CoilType::Reset,
            };
            if energized {
                powered_coils.push(coil.var.clone());
            }
            CoilState { coil_id: coil.var.clone(), coil_type, energized }
        }).collect();

        // Apply coil results to var store for rung-to-rung propagation
        for cs in &coil_states {
            vars.set_bool(&cs.coil_id, cs.energized);
        }

        // Update snapshot so rung N+1 contacts see rung N coil results (IEC §4.1.2)
        input_snapshot = vars.snapshot();

        rung_states.push(RungState {
            rung_id: rung.id.clone(),
            contact_states,
            coil_states,
        });
    }

    edge_state.advance_cycle(&input_snapshot);
    PowerFlowResult { rung_states, powered_coils }
}

// ---------------------------------------------------------------------------
// Convenience: simple serial rung builder
// ---------------------------------------------------------------------------

/// Build a simple serial contact network from a list of contacts.
///
/// This is a convenience for test code and simple serial rungs.
/// Parallel branches require building the ContactNetwork manually.
pub fn build_serial_network(contacts: &[Contact]) -> ContactNetwork {
    let mut network = ContactNetwork::new();
    let left = network.add_node();
    network.set_left_rail(left);
    let mut prev = left;
    for contact in contacts {
        let next = network.add_node();
        network.add_edge(prev, next, contact.clone());
        prev = next;
    }
    network.set_output_node(prev);
    network
}

/// Build a parallel network from two or more branch contact lists.
///
/// Each branch is a list of contacts in series. All branches share the
/// same left rail node and converge to the same output node.
pub fn build_parallel_network(branches: &[Vec<Contact>]) -> ContactNetwork {
    let mut network = ContactNetwork::new();
    let left = network.add_node();
    network.set_left_rail(left);
    let output = network.add_node();
    network.set_output_node(output);

    for branch_contacts in branches {
        let mut prev = left;
        let len = branch_contacts.len();
        for (i, contact) in branch_contacts.iter().enumerate() {
            let next = if i == len - 1 {
                output // last contact in branch → output node
            } else {
                network.add_node()
            };
            network.add_edge(prev, next, contact.clone());
            prev = next;
        }
    }

    network
}

#[cfg(test)]
mod tests;
#[cfg(test)]
mod test_vectors;
