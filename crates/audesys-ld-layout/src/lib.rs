//! AUDESYS LD Layout Engine — automatic ladder diagram element positioning.
//!
//! Takes an `LdGraph` JSON as input and returns an updated `LdGraph` JSON
//! with optimized positions for all elements. The layout pipeline is:
//!
//! 1. **validate** — check connectivity, rung completeness, overlaps, orphans
//! 2. **layout_rungs** — assign rungs to rows top-to-bottom
//! 3. **layout_contacts** — position contacts left-to-right within each rung
//! 4. **layout_coils** — position coils at the right end of each rung
//! 5. **route_wires** — compute Manhattan-style wire routing points
//! 6. **auto_number** — number rungs 001, 002, 003...
//!
//! Phase 1: simple algorithm. No genetic optimization, no global compaction.
//! Perfect auto-layout is Phase 2+ work.

mod rung_layout;
mod validation;
mod wire_routing;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ═══════════════════════════════════════════════════════════════════════════
// Geometry types — match TS GModel Point / Dimension
// ═══════════════════════════════════════════════════════════════════════════

/// 2D point in diagram canvas (abstract units).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

impl Point {
    pub const fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }
}

/// Width and height of a diagram element.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Size {
    pub width: f64,
    pub height: f64,
}

impl Size {
    pub const fn new(width: f64, height: f64) -> Self {
        Self { width, height }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Node / Edge / Rung — mirror TS LdGraph model
// ═══════════════════════════════════════════════════════════════════════════

/// A single node in the ladder diagram.
///
/// `extra` holds type-specific fields (variableName, contactType, coilType,
/// fbType, side, ...) so all node kinds share one struct. The layout engine
/// only cares about `kind`, `position`, and `size`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutNode {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub position: Point,
    pub size: Size,
    /// All remaining node fields (variableName, contactType, coilType, fbType,
    /// side, cssClasses, ...) are preserved as-is through layout.
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

impl LayoutNode {
    /// Right edge x coordinate.
    pub fn right(&self) -> f64 {
        self.position.x + self.size.width
    }
    /// Bottom edge y coordinate.
    pub fn bottom(&self) -> f64 {
        self.position.y + self.size.height
    }
    /// Horizontal centre x.
    pub fn cx(&self) -> f64 {
        self.position.x + self.size.width / 2.0
    }
    /// Vertical centre y.
    pub fn cy(&self) -> f64 {
        self.position.y + self.size.height / 2.0
    }
    /// Bounding box: (min_x, min_y, max_x, max_y).
    pub fn bbox(&self) -> (f64, f64, f64, f64) {
        (
            self.position.x,
            self.position.y,
            self.right(),
            self.bottom(),
        )
    }
    /// True if `self` overlaps `other`.
    pub fn overlaps(&self, other: &LayoutNode) -> bool {
        let (ax1, ay1, ax2, ay2) = self.bbox();
        let (bx1, by1, bx2, by2) = other.bbox();
        ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1
    }
}

/// An edge between two nodes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutEdge {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(rename = "sourceId")]
    pub source_id: String,
    #[serde(rename = "targetId")]
    pub target_id: String,
    /// Wire routing waypoints (computed by the layout engine).
    #[serde(rename = "routingPoints", default, skip_serializing_if = "Vec::is_empty")]
    pub routing_points: Vec<Point>,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

/// A single rung defining its element IDs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RungDef {
    pub id: String,
    #[serde(rename = "rungNumber")]
    pub rung_number: u32,
    #[serde(default)]
    pub comment: Option<String>,
    #[serde(rename = "elementIds")]
    pub element_ids: Vec<String>,
}

// ═══════════════════════════════════════════════════════════════════════════
// Layout I/O
// ═══════════════════════════════════════════════════════════════════════════

/// Input to the layout engine — deserialized from LdGraph JSON.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutInput {
    #[serde(default)]
    pub id: String,
    pub nodes: Vec<LayoutNode>,
    pub edges: Vec<LayoutEdge>,
    pub rungs: Vec<RungDef>,
}

/// Output from the layout engine — positions updated, wires routed.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutOutput {
    pub id: String,
    pub nodes: Vec<LayoutNode>,
    pub edges: Vec<LayoutEdge>,
    pub rungs: Vec<RungDef>,
}

/// Warnings or info produced during layout (non-fatal).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutWarning {
    pub code: String,
    pub message: String,
}

// ═══════════════════════════════════════════════════════════════════════════
// Pipeline
// ═══════════════════════════════════════════════════════════════════════════

/// Run the full layout pipeline and return the updated graph.
///
/// # Arguments
/// * `input` — The LdGraph to lay out (nodes may have arbitrary positions).
///
/// # Returns
/// * `LayoutOutput` with recalculated positions, routing points, and rung
///   numbering.
pub fn layout_ld(input: LayoutInput) -> LayoutOutput {
    let nodes = input.nodes;
    let edges = input.edges;
    let mut rungs = input.rungs;

    // Build lookup
    let node_map: HashMap<String, usize> = nodes
        .iter()
        .enumerate()
        .map(|(i, n)| (n.id.clone(), i))
        .collect();

    // Step 0: Validate (warnings only — non-fatal)
    let _report = validation::validate(&nodes, &edges, &rungs);

    // Step 1: Auto-number rungs
    rung_layout::auto_number(&mut rungs);

    // Step 2: Assign rung rows (positions each rung's elements in a row)
    let (rung_rows, rail_y, rail_height, coil_x, rail_right_x) =
        rung_layout::layout_rungs(&nodes, &rungs, &node_map);

    // Step 3: Position contacts left-to-right within each rung
    let nodes = rung_layout::layout_contacts(nodes, &rungs, &node_map, &rung_rows);

    // Step 4: Position coils at right end of each rung
    let nodes = rung_layout::layout_coils(nodes, &rungs, &node_map, &rung_rows, coil_x);

    // Step 5: Position power rails
    let nodes = rung_layout::layout_rails(nodes, &node_map, rail_y, rail_height, rail_right_x);

    // Step 6: Route wires (Manhattan-style)
    let edges = wire_routing::route_wires(edges, &nodes, &node_map);

    LayoutOutput {
        id: input.id,
        nodes,
        edges,
        rungs,
    }
}

/// Run layout and return the result as a JSON string.
///
/// Convenience function for napi-rs / FFI callers.
pub fn layout_ld_json(input: &str) -> Result<String, String> {
    let input: LayoutInput =
        serde_json::from_str(input).map_err(|e| format!("deserialize input: {e}"))?;
    let output = layout_ld(input);
    serde_json::to_string(&output).map_err(|e| format!("serialize output: {e}"))
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

/// Left power rail x position.
pub const RAIL_LEFT_X: f64 = 20.0;
/// Right power rail x position (ponytail: hard-coded ~1000px diagram — Phase 2
/// can compute from max element positions).
pub const RAIL_RIGHT_X: f64 = 920.0;
/// Power rail width.
pub const RAIL_WIDTH: f64 = 4.0;
/// X offset from left rail to first element.
pub const ELEMENT_START_X: f64 = RAIL_LEFT_X + RAIL_WIDTH + 60.0;
/// Horizontal spacing between elements within a rung.
pub const ELEMENT_SPACING_X: f64 = 40.0;
/// Vertical spacing between rungs.
pub const RUNG_SPACING_Y: f64 = 60.0;
/// Y position of first rung.
pub const RUNG_START_Y: f64 = 50.0;
/// Default element height (used for rung row layout).
pub const DEFAULT_ELEMENT_HEIGHT: f64 = 36.0;

#[cfg(test)]
mod tests {
    use super::*;

    fn make_node(id: &str, kind: &str) -> LayoutNode {
        LayoutNode {
            id: id.into(),
            kind: kind.into(),
            position: Point::new(0.0, 0.0),
            size: Size::new(36.0, 36.0),
            extra: serde_json::Map::new(),
        }
    }

    #[test]
    fn point_overlaps_detection() {
        let a = LayoutNode {
            id: "a".into(),
            kind: "node:contact".into(),
            position: Point::new(0.0, 0.0),
            size: Size::new(36.0, 36.0),
            extra: serde_json::Map::new(),
        };
        let b = LayoutNode {
            id: "b".into(),
            kind: "node:contact".into(),
            position: Point::new(18.0, 18.0),
            size: Size::new(36.0, 36.0),
            extra: serde_json::Map::new(),
        };
        let c = LayoutNode {
            id: "c".into(),
            kind: "node:coil".into(),
            position: Point::new(100.0, 100.0),
            size: Size::new(36.0, 36.0),
            extra: serde_json::Map::new(),
        };
        assert!(a.overlaps(&b));
        assert!(!a.overlaps(&c));
    }

    #[test]
    fn empty_graph_roundtrips() {
        let input = LayoutInput {
            id: "test".into(),
            nodes: vec![],
            edges: vec![],
            rungs: vec![],
        };
        let output = layout_ld(input);
        assert_eq!(output.id, "test");
        assert!(output.nodes.is_empty());
        assert!(output.edges.is_empty());
        assert!(output.rungs.is_empty());
    }

    #[test]
    fn auto_number_sets_rung_numbers() {
        let input = LayoutInput {
            id: "test".into(),
            nodes: vec![],
            edges: vec![],
            rungs: vec![
                RungDef {
                    id: "r1".into(),
                    rung_number: 0,
                    comment: None,
                    element_ids: vec![],
                },
                RungDef {
                    id: "r2".into(),
                    rung_number: 0,
                    comment: None,
                    element_ids: vec![],
                },
            ],
        };
        let output = layout_ld(input);
        assert_eq!(output.rungs[0].rung_number, 1);
        assert_eq!(output.rungs[1].rung_number, 2);
    }

    #[test]
    fn simple_rung_positions_elements() {
        // One rung: contact "c1" + coil "o1"
        let input = LayoutInput {
            id: "test".into(),
            nodes: vec![
                make_node("c1", "node:contact"),
                make_node("o1", "node:coil"),
            ],
            edges: vec![],
            rungs: vec![RungDef {
                id: "r1".into(),
                rung_number: 0,
                comment: None,
                element_ids: vec!["c1".into(), "o1".into()],
            }],
        };
        let output = layout_ld(input);
        // Contact should be positioned at ELEMENT_START_X, first rung row
        let contact = output
            .nodes
            .iter()
            .find(|n| n.id == "c1")
            .expect("contact exists");
        assert!(contact.position.x >= ELEMENT_START_X);
        // Coil should be to the right of the contact
        let coil = output
            .nodes
            .iter()
            .find(|n| n.id == "o1")
            .expect("coil exists");
        assert!(coil.position.x > contact.position.x);
    }

    #[test]
    fn layout_deterministic_output() {
        let input = LayoutInput {
            id: "test".into(),
            nodes: vec![
                make_node("c1", "node:contact"),
                make_node("o1", "node:coil"),
            ],
            edges: vec![],
            rungs: vec![RungDef {
                id: "r1".into(),
                rung_number: 0,
                comment: None,
                element_ids: vec!["c1".into(), "o1".into()],
            }],
        };
        let a = layout_ld(input.clone());
        let b = layout_ld(input);
        assert_eq!(
            serde_json::to_string(&a).unwrap(),
            serde_json::to_string(&b).unwrap()
        );
    }

    #[test]
    fn layout_ld_json_roundtrip() {
        let json = r#"{
          "id": "test",
          "nodes": [
            {"id":"c1","type":"node:contact","position":{"x":0,"y":0},"size":{"width":36,"height":36},"variableName":"X1","contactType":"NO"},
            {"id":"o1","type":"node:coil","position":{"x":0,"y":0},"size":{"width":36,"height":36},"variableName":"Y1","coilType":"Normal"}
          ],
          "edges": [],
          "rungs": [{"id":"r1","rungNumber":0,"elementIds":["c1","o1"]}]
        }"#;
        let output = layout_ld_json(json).expect("should succeed");
        let parsed: serde_json::Value =
            serde_json::from_str(&output).expect("valid JSON output");
        assert_eq!(parsed["id"], "test");
        // Check extra fields preserved
        let nodes = parsed["nodes"].as_array().expect("nodes array");
        let contact = nodes
            .iter()
            .find(|v| v["id"] == "c1")
            .expect("contact found");
        assert_eq!(contact["variableName"], "X1");
        assert_eq!(contact["contactType"], "NO");
    }
}
