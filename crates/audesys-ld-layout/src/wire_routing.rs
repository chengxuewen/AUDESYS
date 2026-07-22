//! Wire routing — compute Manhattan-style edge routing points.
//!
//! Phase 1: simple approach:
//! - Horizontal edges (same y): straight line, no routing points needed.
//! - Vertical edges (different y): L-shaped path — go horizontal first,
//!   then vertical.
//! - Power connections: straight horizontal from rail to element.
//!
//! Phase 2+: obstacle avoidance, junction routing, parallel branch routing.

use super::{LayoutEdge, LayoutNode, Point};
use std::collections::HashMap;

/// Compute routing points for all edges.
///
/// Each edge gets a `routing_points` array. If source and target are on the
/// same horizontal line, no routing points are needed (straight line). If they
/// differ in y, a single bend L-shaped path is computed.
///
/// ponytail: Phase 1 does not handle obstacle avoidance — wires may cross
/// elements. Phase 2 can add AABB collision checks and route-around logic.
pub fn route_wires(
    mut edges: Vec<LayoutEdge>,
    nodes: &[LayoutNode],
    node_map: &HashMap<String, usize>,
) -> Vec<LayoutEdge> {
    for edge in edges.iter_mut() {
        let Some(&src_idx) = node_map.get(&edge.source_id) else {
            continue;
        };
        let Some(&tgt_idx) = node_map.get(&edge.target_id) else {
            continue;
        };
        let src = &nodes[src_idx];
        let tgt = &nodes[tgt_idx];

        edge.routing_points = match edge.kind.as_str() {
            "edge:power" => {
                // Power connections: always straight horizontal
                vec![]
            }
            "edge:wire" => {
                compute_wire_route(src, tgt)
            }
            _ => {
                // Unknown edge type: straight line
                vec![]
            }
        };
    }

    edges
}

/// Compute routing points for a single wire edge.
///
/// For a straight horizontal connection (same y), return empty (GLSP draws a
/// straight line between source centre-right and target centre-left).
///
/// For a connection with vertical offset, compute an L-shaped path:
/// - From source right edge → bend point at source.y, target.x →
///   to target left edge.
///
/// Returns `Vec<Point>` of routing waypoints (empty = straight line).
fn compute_wire_route(src: &LayoutNode, tgt: &LayoutNode) -> Vec<Point> {
    let src_cx = src.position.x + src.size.width; // right edge x
    let src_cy = src.position.y + src.size.height / 2.0; // centre y
    let tgt_cx = tgt.position.x; // left edge x
    let tgt_cy = tgt.position.y + tgt.size.height / 2.0; // centre y

    // If on approximately the same horizontal line, no routing needed
    if (src_cy - tgt_cy).abs() < 2.0 {
        return vec![];
    }

    // L-shaped path: bend at the midpoint
    let mid_x = (src_cx + tgt_cx) / 2.0;
    vec![
        Point::new(mid_x, src_cy),
        Point::new(mid_x, tgt_cy),
    ]
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    fn node_at(id: &str, x: f64, y: f64, w: f64, h: f64) -> LayoutNode {
        use serde_json;
        LayoutNode {
            id: id.into(),
            kind: "node:contact".into(),
            position: Point::new(x, y),
            size: super::super::Size::new(w, h),
            extra: serde_json::Map::new(),
        }
    }

    #[test]
    fn straight_horizontal_wire_no_routing_points() {
        let src = node_at("c1", 100.0, 50.0, 36.0, 36.0);
        let tgt = node_at("c2", 200.0, 50.0, 36.0, 36.0);

        let route = compute_wire_route(&src, &tgt);
        assert!(route.is_empty(), "horizontal wire should have no routing points");
    }

    #[test]
    fn vertical_offset_wire_has_bend() {
        let src = node_at("c1", 100.0, 50.0, 36.0, 36.0);
        let tgt = node_at("c2", 200.0, 150.0, 36.0, 36.0);

        let route = compute_wire_route(&src, &tgt);
        assert_eq!(route.len(), 2, "vertical wire should have 2 routing points (L-path)");
    }

    #[test]
    fn power_edge_always_straight() {
        let src = node_at("rl", 20.0, 50.0, 4.0, 600.0);
        let tgt = node_at("c1", 100.0, 50.0, 36.0, 36.0);
        let nodes = vec![src.clone(), tgt.clone()];
        let node_map: HashMap<String, usize> =
            [("rl".into(), 0), ("c1".into(), 1)].into_iter().collect();

        let edge = LayoutEdge {
            id: "p1".into(),
            kind: "edge:power".into(),
            source_id: "rl".into(),
            target_id: "c1".into(),
            routing_points: vec![],
            extra: serde_json::Map::new(),
        };

        let result = route_wires(vec![edge], &nodes, &node_map);
        assert!(result[0].routing_points.is_empty());
    }

    #[test]
    fn missing_nodes_dont_panic() {
        let nodes = vec![node_at("c1", 100.0, 50.0, 36.0, 36.0)];
        let node_map: HashMap<String, usize> =
            [("c1".into(), 0)].into_iter().collect();

        // Edge referencing a non-existent node
        let edge = LayoutEdge {
            id: "e1".into(),
            kind: "edge:wire".into(),
            source_id: "c1".into(),
            target_id: "c2".into(), // doesn't exist
            routing_points: vec![],
            extra: serde_json::Map::new(),
        };

        let result = route_wires(vec![edge], &nodes, &node_map);
        // Should not panic; routing_points remain empty
        assert!(result[0].routing_points.is_empty());
    }
}
