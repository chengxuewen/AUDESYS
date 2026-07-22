//! Rung layout — vertical positioning and element arrangement within rungs.
//!
//! Pipeline steps:
//! 1. `auto_number` — number rungs 001, 002, 003...
//! 2. `layout_rungs` — compute row positions for each rung
//! 3. `layout_contacts` — position contacts left-to-right within each rung
//! 4. `layout_coils` — position coils at right end of rungs
//! 5. `layout_rails` — position power rails

use super::{
    LayoutNode, Point, RungDef, Size, DEFAULT_ELEMENT_HEIGHT, ELEMENT_SPACING_X, ELEMENT_START_X,
    RAIL_LEFT_X, RAIL_RIGHT_X, RAIL_WIDTH, RUNG_SPACING_Y, RUNG_START_Y,
};
use std::collections::HashMap;

/// Row assignment for a single rung.
#[derive(Debug, Clone, Copy)]
pub struct RungRow {
    /// The rung index (0-based).
    pub index: usize,
    /// Vertical position for elements on this rung (centre y of the rung lane).
    pub y: f64,
}

/// Number rungs sequentially starting from 1.
pub fn auto_number(rungs: &mut [RungDef]) {
    for (i, rung) in rungs.iter_mut().enumerate() {
        rung.rung_number = (i + 1) as u32;
    }
}

/// Compute row positions for all rungs and return power rail positioning info.
///
/// Returns:
/// * `rung_rows` — Vec of RungRow, one per rung in order
/// * `rail_y` — top y of the left/right power rails
/// * `rail_height` — total height the rails should span
/// * `coil_x` — x position for coils (right side of diagram)
/// * `rail_right_x` — x position for right power rail
pub fn layout_rungs(
    nodes: &[LayoutNode],
    rungs: &[RungDef],
    _node_map: &HashMap<String, usize>,
) -> (Vec<RungRow>, f64, f64, f64, f64) {
    // Determine the width needed: find the widest element or use default
    let max_element_width = nodes
        .iter()
        .map(|n| n.size.width)
        .fold(0.0_f64, f64::max);

    // ponytail: in Phase 1, right rail is at a fixed position.
    // Phase 2 can compute it from max contact chain length.
    let coil_x = RAIL_RIGHT_X - RAIL_WIDTH - 60.0 - max_element_width;
    let rail_right_x = RAIL_RIGHT_X;

    let rung_rows: Vec<RungRow> = rungs
        .iter()
        .enumerate()
        .map(|(i, _)| RungRow {
            index: i,
            y: RUNG_START_Y + (i as f64) * (DEFAULT_ELEMENT_HEIGHT + RUNG_SPACING_Y),
        })
        .collect();

    // Compute rail extent: from first rung's top to last rung's bottom
    let rail_y = if rungs.is_empty() {
        RUNG_START_Y
    } else {
        RUNG_START_Y - 20.0 // margin above first rung
    };
    let rail_height = if rungs.is_empty() {
        600.0 // default diagram height
    } else {
        let last_row = &rung_rows[rung_rows.len() - 1];
        (last_row.y + DEFAULT_ELEMENT_HEIGHT + 20.0) - rail_y
    };

    (rung_rows, rail_y, rail_height, coil_x, rail_right_x)
}

/// Position contact nodes left-to-right within each rung.
///
/// Contacts form a horizontal chain. Multiple contacts in series = multiple
/// elements side by side. Contacts are always on the left side of the rung.
pub fn layout_contacts(
    mut nodes: Vec<LayoutNode>,
    rungs: &[RungDef],
    node_map: &HashMap<String, usize>,
    rung_rows: &[RungRow],
) -> Vec<LayoutNode> {
    for rung in rungs {
        let row = rung_rows
            .iter()
            .find(|r| r.index == (rung.rung_number as usize - 1));
        let Some(row) = row else {
            continue;
        };

        let mut contact_count: usize = 0;
        let mut fb_seen = false;
        let mut fb_width_offset = 0.0;

        for elem_id in &rung.element_ids {
            let Some(&idx) = node_map.get(elem_id) else {
                continue;
            };
            // ponytail: clone kind + copy width to avoid borrow-conflict with mutable nodes[idx]
            let node_kind = nodes[idx].kind.clone();
            let node_w = nodes[idx].size.width;

            match node_kind.as_str() {
                "node:contact" => {
                    let x = if fb_seen {
                        // Contacts after FB start after the FB
                        ELEMENT_START_X
                            + fb_width_offset
                            + ELEMENT_SPACING_X
                            + (contact_count as f64) * (node_w + ELEMENT_SPACING_X)
                    } else {
                        ELEMENT_START_X
                            + (contact_count as f64) * (node_w + ELEMENT_SPACING_X)
                    };
                    nodes[idx].position = Point::new(x, row.y);
                    contact_count += 1;
                }
                "node:fb" => {
                    // Position FB after contacts, if any
                    let fb_x = ELEMENT_START_X
                        + (contact_count as f64) * (node_w + ELEMENT_SPACING_X);
                    nodes[idx].position = Point::new(fb_x, row.y);
                    fb_seen = true;
                    fb_width_offset = node_w;
                }
                _ => {
                    // coils and other types handled by layout_coils
                }
            }
        }
    }

    nodes
}

/// Position coil nodes at the right end of each rung.
///
/// Coils are always the rightmost element (before the right power rail).
pub fn layout_coils(
    mut nodes: Vec<LayoutNode>,
    rungs: &[RungDef],
    node_map: &HashMap<String, usize>,
    rung_rows: &[RungRow],
    coil_x: f64,
) -> Vec<LayoutNode> {
    for rung in rungs {
        let row = rung_rows
            .iter()
            .find(|r| r.index == (rung.rung_number as usize - 1));
        let Some(row) = row else {
            continue;
        };

        let mut coil_count: usize = 0;

        for elem_id in &rung.element_ids {
            let Some(&idx) = node_map.get(elem_id) else {
                continue;
            };
            let node_w = nodes[idx].size.width;

            if nodes[idx].kind == "node:coil" {
                let x = coil_x + (coil_count as f64) * (node_w + ELEMENT_SPACING_X);
                nodes[idx].position = Point::new(x, row.y);
                coil_count += 1;
            }
        }
    }

    nodes
}

/// Position power rail nodes.
///
/// Left rail at RAIL_LEFT_X, right rail at RAIL_RIGHT_X.
pub fn layout_rails(
    mut nodes: Vec<LayoutNode>,
    _node_map: &HashMap<String, usize>,
    rail_y: f64,
    rail_height: f64,
    rail_right_x: f64,
) -> Vec<LayoutNode> {
    for node in nodes.iter_mut() {
        if node.kind == "node:powerrail" {
            let side = node
                .extra
                .get("side")
                .and_then(|v| v.as_str())
                .unwrap_or("Left");
            match side {
                "Right" => {
                    node.position = Point::new(rail_right_x, rail_y);
                    node.size = Size::new(RAIL_WIDTH, rail_height);
                }
                _ => {
                    // Left rail (default)
                    node.position = Point::new(RAIL_LEFT_X, rail_y);
                    node.size = Size::new(RAIL_WIDTH, rail_height);
                }
            }
        }
    }
    nodes
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

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

    fn make_rung(id: &str, num: u32, element_ids: Vec<&str>) -> RungDef {
        RungDef {
            id: id.into(),
            rung_number: num,
            comment: None,
            element_ids: element_ids.into_iter().map(|s| s.to_string()).collect(),
        }
    }

    #[test]
    fn auto_number_starts_at_1() {
        let mut rungs = vec![
            make_rung("r1", 0, vec![]),
            make_rung("r2", 0, vec![]),
            make_rung("r3", 0, vec![]),
        ];
        auto_number(&mut rungs);
        assert_eq!(rungs[0].rung_number, 1);
        assert_eq!(rungs[1].rung_number, 2);
        assert_eq!(rungs[2].rung_number, 3);
    }

    #[test]
    fn rung_rows_vertical_spacing() {
        let nodes = vec![make_node("c1", "node:contact")];
        let rungs = vec![
            make_rung("r1", 1, vec!["c1"]),
            make_rung("r2", 2, vec!["c1"]),
            make_rung("r3", 3, vec!["c1"]),
        ];
        let node_map: HashMap<String, usize> =
            [("c1".into(), 0usize)].into_iter().collect();
        let (rows, _, _, _, _) = layout_rungs(&nodes, &rungs, &node_map);

        assert_eq!(rows.len(), 3);
        assert!((rows[0].y - RUNG_START_Y).abs() < 0.01);
        assert!(rows[1].y > rows[0].y);
        assert!(rows[2].y > rows[1].y);
        // Spacing should be (DEFAULT_ELEMENT_HEIGHT + RUNG_SPACING_Y)
        let expected_step = DEFAULT_ELEMENT_HEIGHT + RUNG_SPACING_Y;
        assert!(((rows[1].y - rows[0].y) - expected_step).abs() < 0.01);
    }

    #[test]
    fn contacts_positioned_left_to_right() {
        let nodes = vec![
            make_node("c1", "node:contact"),
            make_node("c2", "node:contact"),
            make_node("c3", "node:contact"),
        ];
        let rungs = vec![make_rung("r1", 1, vec!["c1", "c2", "c3"])];
        let node_map: HashMap<String, usize> = [
            ("c1".into(), 0),
            ("c2".into(), 1),
            ("c3".into(), 2),
        ]
        .into_iter()
        .collect();
        let (rows, _, _, _, _) = layout_rungs(&nodes, &rungs, &node_map);

        let result = layout_contacts(nodes, &rungs, &node_map, &rows);

        let c1 = &result[0];
        let c2 = &result[1];
        let c3 = &result[2];
        assert!(c1.position.x >= ELEMENT_START_X);
        assert!(c2.position.x > c1.position.x);
        assert!(c3.position.x > c2.position.x);
        // All contacts on same y row
        assert!((c1.position.y - c2.position.y).abs() < 0.01);
        assert!((c2.position.y - c3.position.y).abs() < 0.01);
    }

    #[test]
    fn coil_positioned_at_right_end() {
        let nodes = vec![make_node("c1", "node:contact"), make_node("o1", "node:coil")];
        let rungs = vec![make_rung("r1", 1, vec!["c1", "o1"])];
        let node_map: HashMap<String, usize> =
            [("c1".into(), 0), ("o1".into(), 1)].into_iter().collect();
        let (rows, _, _, coil_x, _) = layout_rungs(&nodes, &rungs, &node_map);

        let intermediate = layout_contacts(nodes, &rungs, &node_map, &rows);
        let result = layout_coils(intermediate, &rungs, &node_map, &rows, coil_x);

        let coil = &result[1];
        assert!(coil.position.x > RAIL_LEFT_X + 100.0, "coil should be far right");
        assert!(coil.position.x < RAIL_RIGHT_X - RAIL_WIDTH);
    }

    #[test]
    fn power_rails_positioned_at_sides() {
        let mut left = make_node("rl", "node:powerrail");
        left
            .extra
            .insert("side".into(), serde_json::Value::String("Left".into()));
        let mut right = make_node("rr", "node:powerrail");
        right
            .extra
            .insert("side".into(), serde_json::Value::String("Right".into()));

        let nodes = vec![left, right];
        let node_map: HashMap<String, usize> =
            [("rl".into(), 0), ("rr".into(), 1)].into_iter().collect();

        let result = layout_rails(nodes, &node_map, 0.0, 600.0, RAIL_RIGHT_X);

        assert!((result[0].position.x - RAIL_LEFT_X).abs() < 0.01);
        assert!((result[1].position.x - RAIL_RIGHT_X).abs() < 0.01);
        assert!((result[0].size.height - 600.0).abs() < 0.01);
        assert!((result[1].size.height - 600.0).abs() < 0.01);
    }

    #[test]
    fn multi_rung_different_y_positions() {
        let nodes = vec![
            make_node("c1", "node:contact"),
            make_node("o1", "node:coil"),
            make_node("c2", "node:contact"),
            make_node("o2", "node:coil"),
        ];
        let rungs = vec![
            make_rung("r1", 1, vec!["c1", "o1"]),
            make_rung("r2", 2, vec!["c2", "o2"]),
        ];
        let node_map: HashMap<String, usize> = [
            ("c1".into(), 0),
            ("o1".into(), 1),
            ("c2".into(), 2),
            ("o2".into(), 3),
        ]
        .into_iter()
        .collect();
        let (rows, _, _, coil_x, _) = layout_rungs(&nodes, &rungs, &node_map);

        let intermediate = layout_contacts(nodes, &rungs, &node_map, &rows);
        let result = layout_coils(intermediate, &rungs, &node_map, &rows, coil_x);

        // c1 and o1 should be on same y, c2 and o2 on a different y
        assert!((result[0].position.y - result[1].position.y).abs() < 0.01);
        assert!((result[2].position.y - result[3].position.y).abs() < 0.01);
        assert!((result[0].position.y - result[2].position.y).abs() > 10.0,
            "rungs should be on different rows");
    }
}
