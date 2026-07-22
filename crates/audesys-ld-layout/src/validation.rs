//! LD diagram validation — structural checks on ladder diagrams.
//!
//! Checks performed (Phase 1 — warnings only, no errors block layout):
//! - Connectivity: all nodes referenced by at least one edge
//! - Rung completeness: each rung has ≥1 contact and ≥1 coil
//! - Overlap detection: elements whose bounding boxes intersect
//! - Orphan detection: nodes not assigned to any rung

use super::{LayoutEdge, LayoutNode, RungDef};
use std::collections::{HashMap, HashSet};

/// Result of a validation pass.
///
/// ponytail: fields not yet consumed in Phase 1 pipeline — available for
/// diagnostic display in Phase 2.
#[allow(dead_code)]
#[derive(Debug, Clone, Default)]
pub struct ValidationReport {
    /// Warnings (non-fatal issues).
    pub warnings: Vec<String>,
    /// List of unconnected node IDs.
    pub unconnected: Vec<String>,
    /// List of incomplete rung IDs (missing contact or coil).
    pub incomplete_rungs: Vec<String>,
    /// List of orphan node IDs (not in any rung).
    pub orphans: Vec<String>,
    /// List of overlapping node ID pairs.
    pub overlaps: Vec<(String, String)>,
}

/// Run all validation checks and return a report.
///
/// Validation never fails — it only produces warnings. The layout engine
/// continues regardless of validation results.
pub fn validate(
    nodes: &[LayoutNode],
    edges: &[LayoutEdge],
    rungs: &[RungDef],
) -> ValidationReport {
    ValidationReport {
        warnings: vec![],
        unconnected: check_connectivity(nodes, edges),
        incomplete_rungs: check_rung_completeness(nodes, rungs),
        orphans: check_orphans(nodes, rungs),
        overlaps: check_overlaps(nodes),
    }
}

/// Check that every non-rail node is referenced by at least one edge.
fn check_connectivity(nodes: &[LayoutNode], edges: &[LayoutEdge]) -> Vec<String> {
    let connected: HashSet<&str> = edges
        .iter()
        .flat_map(|e| [e.source_id.as_str(), e.target_id.as_str()])
        .collect();

    nodes
        .iter()
        .filter(|n| n.kind != "node:powerrail" && !connected.contains(n.id.as_str()))
        .map(|n| n.id.clone())
        .collect()
}

/// Check that each rung has at least one contact and one coil.
fn check_rung_completeness(nodes: &[LayoutNode], rungs: &[RungDef]) -> Vec<String> {
    let kind_map: HashMap<&str, &str> = nodes
        .iter()
        .map(|n| (n.id.as_str(), n.kind.as_str()))
        .collect();

    rungs
        .iter()
        .filter(|rung| {
            if rung.element_ids.is_empty() {
                return true; // empty rung = incomplete
            }
            let has_contact = rung
                .element_ids
                .iter()
                .any(|eid| kind_map.get(eid.as_str()).copied() == Some("node:contact"));
            let has_coil = rung
                .element_ids
                .iter()
                .any(|eid| kind_map.get(eid.as_str()).copied() == Some("node:coil"));
            !has_contact || !has_coil
        })
        .map(|r| r.id.clone())
        .collect()
}

/// Find nodes not assigned to any rung (excluding power rails).
fn check_orphans(nodes: &[LayoutNode], rungs: &[RungDef]) -> Vec<String> {
    let assigned: HashSet<&str> = rungs
        .iter()
        .flat_map(|r| r.element_ids.iter().map(|s| s.as_str()))
        .collect();

    nodes
        .iter()
        .filter(|n| n.kind != "node:powerrail" && !assigned.contains(n.id.as_str()))
        .map(|n| n.id.clone())
        .collect()
}

/// Detect overlapping element bounding boxes.
///
/// Only checks non-rail nodes. Returns pairs of overlapping IDs.
fn check_overlaps(nodes: &[LayoutNode]) -> Vec<(String, String)> {
    let mut overlaps = Vec::new();
    let elements: Vec<&LayoutNode> = nodes
        .iter()
        .filter(|n| n.kind != "node:powerrail")
        .collect();

    for i in 0..elements.len() {
        for j in (i + 1)..elements.len() {
            if elements[i].overlaps(elements[j]) {
                overlaps.push((elements[i].id.clone(), elements[j].id.clone()));
            }
        }
    }

    overlaps
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::{Point, Size};

    fn make_node(id: &str, kind: &str, x: f64, y: f64) -> LayoutNode {
        LayoutNode {
            id: id.into(),
            kind: kind.into(),
            position: Point::new(x, y),
            size: Size::new(36.0, 36.0),
            extra: serde_json::Map::new(),
        }
    }

    fn make_rung(id: &str, element_ids: Vec<&str>) -> RungDef {
        RungDef {
            id: id.into(),
            rung_number: 1,
            comment: None,
            element_ids: element_ids.into_iter().map(|s| s.to_string()).collect(),
        }
    }

    fn make_edge(id: &str, kind: &str, src: &str, tgt: &str) -> LayoutEdge {
        LayoutEdge {
            id: id.into(),
            kind: kind.into(),
            source_id: src.into(),
            target_id: tgt.into(),
            routing_points: vec![],
            extra: serde_json::Map::new(),
        }
    }

    #[test]
    fn connected_nodes_have_no_unconnected() {
        let nodes = vec![make_node("c1", "node:contact", 0.0, 0.0)];
        let edges = vec![make_edge("e1", "edge:wire", "c1", "c2")];
        let unconnected = check_connectivity(&nodes, &edges);
        assert!(unconnected.is_empty());
    }

    #[test]
    fn unconnected_node_detected() {
        let nodes = vec![
            make_node("c1", "node:contact", 0.0, 0.0),
            make_node("c2", "node:contact", 100.0, 0.0),
        ];
        let edges = vec![make_edge("e1", "edge:wire", "c1", "o1")];
        let unconnected = check_connectivity(&nodes, &edges);
        assert!(unconnected.contains(&"c2".to_string()));
    }

    #[test]
    fn rails_excluded_from_connectivity_check() {
        let nodes = vec![make_node("rl", "node:powerrail", 0.0, 0.0)];
        let edges = vec![];
        let unconnected = check_connectivity(&nodes, &edges);
        assert!(unconnected.is_empty());
    }

    #[test]
    fn complete_rung_passes() {
        let nodes = vec![
            make_node("c1", "node:contact", 0.0, 0.0),
            make_node("o1", "node:coil", 100.0, 0.0),
        ];
        let rungs = vec![make_rung("r1", vec!["c1", "o1"])];
        let incomplete = check_rung_completeness(&nodes, &rungs);
        assert!(incomplete.is_empty());
    }

    #[test]
    fn rung_without_coil_is_incomplete() {
        let nodes = vec![make_node("c1", "node:contact", 0.0, 0.0)];
        let rungs = vec![make_rung("r1", vec!["c1"])];
        let incomplete = check_rung_completeness(&nodes, &rungs);
        assert!(incomplete.contains(&"r1".to_string()));
    }

    #[test]
    fn rung_without_contact_is_incomplete() {
        let nodes = vec![make_node("o1", "node:coil", 100.0, 0.0)];
        let rungs = vec![make_rung("r1", vec!["o1"])];
        let incomplete = check_rung_completeness(&nodes, &rungs);
        assert!(incomplete.contains(&"r1".to_string()));
    }

    #[test]
    fn empty_rung_is_incomplete() {
        let nodes = vec![];
        let rungs = vec![make_rung("r1", vec![])];
        let incomplete = check_rung_completeness(&nodes, &rungs);
        assert!(incomplete.contains(&"r1".to_string()));
    }

    #[test]
    fn orphan_nodes_detected() {
        let nodes = vec![
            make_node("c1", "node:contact", 0.0, 0.0),
            make_node("c2", "node:contact", 100.0, 0.0),
        ];
        let rungs = vec![make_rung("r1", vec!["c1"])];
        let orphans = check_orphans(&nodes, &rungs);
        assert_eq!(orphans, vec!["c2".to_string()]);
    }

    #[test]
    fn rails_not_orphans() {
        let nodes = vec![make_node("rl", "node:powerrail", 0.0, 0.0)];
        let rungs = vec![];
        let orphans = check_orphans(&nodes, &rungs);
        assert!(orphans.is_empty());
    }

    #[test]
    fn overlapping_elements_detected() {
        let nodes = vec![
            make_node("c1", "node:contact", 0.0, 0.0),
            make_node("c2", "node:contact", 18.0, 18.0),
        ];
        let overlaps = check_overlaps(&nodes);
        assert_eq!(overlaps.len(), 1);
    }

    #[test]
    fn non_overlapping_elements_clean() {
        let nodes = vec![
            make_node("c1", "node:contact", 0.0, 0.0),
            make_node("c2", "node:contact", 100.0, 100.0),
        ];
        let overlaps = check_overlaps(&nodes);
        assert!(overlaps.is_empty());
    }
}
