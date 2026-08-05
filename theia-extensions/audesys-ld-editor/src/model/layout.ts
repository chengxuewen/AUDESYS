/**
 * LD Topology Layout — derived positions from rung structure (D112).
 *
 * Positions are NOT stored on nodes anymore (the `position` field on
 * BaseNode is deprecated and ignored by the renderer). Instead, this
 * module derives every element's position from the rung's ordered
 * `elementIds` list — the topology IS the layout.
 *
 * Layout rules (v2 plan, post 3-reviewer audit):
 *   - Progressive-width cursor: x starts at LD_GRID.x, each series element
 *     advances the cursor by its `effective_width` (type-dispatched so
 *     variable-width elements — comparison 80px, FB 140px — never overlap
 *     contacts):
 *       contact      → CONTACT_SIZE + 4            (36+4  = 40)
 *       comparison   → COMPARISON_WIDTH + 4        (80+4  = 84)
 *       fb           → FB_WIDTH + LD_GRID.x        (140+40 = 180)
 *       coil         → fixed at COIL_X_OFFSET (600)
 *   - Branch members: x = anchor.x (derived from the anchor's series slot),
 *     y = BRANCH_FIRST_Y + memberIdx * LD_GRID.y
 *   - layoutGraph: rungs stack vertically; each rung's height covers its
 *     main row plus the deepest branch-member row; power rails span the
 *     total height at x=0 / RAIL_X_RIGHT.
 */
import { LdGraph, Rung } from './model';
import { BaseNode, Point } from './nodes';
import {
    LD_GRID, CONTACT_SIZE, COMPARISON_WIDTH, FB_WIDTH, COIL_X_OFFSET,
    RAIL_X_RIGHT, BRANCH_FIRST_Y, ELEMENT_Y,
} from './grid';

/** Gap between consecutive series elements (grid cell minus node width). */
const SERIES_GAP = LD_GRID.x; // 40

/** Effective horizontal footprint of a series element in the cursor. */
function effectiveWidth(node: BaseNode | undefined): number {
    switch (node?.type) {
        case 'node:comparison':
            return COMPARISON_WIDTH + 4;          // 84
        case 'node:fb':
            return FB_WIDTH + SERIES_GAP;         // 180
        case 'node:coil':
            return 0;                             // coil has fixed x, no cursor advance
        default:
            return CONTACT_SIZE + 4;              // 40 (36 node + 4px gap)
    }
}

/** Look up a node by id (fast path via a prebuilt map). */
type NodeMap = Map<string, BaseNode>;

function nodeMap(graph: LdGraph): NodeMap {
    const m = new Map<string, BaseNode>();
    for (const n of graph.nodes) m.set(n.id, n);
    return m;
}

/**
 * Derive the position of every element on one rung (series + branches).
 * Coils are pinned to COIL_X_OFFSET; series elements use a progressive
 * cursor; branch members hang under their anchor.
 */
export function layoutRung(rung: Rung, graph: LdGraph): Map<string, Point> {
    const nodes = nodeMap(graph);
    const positions = new Map<string, Point>();

    // Main series row: progressive cursor.
    const seriesX = new Map<string, number>();
    let cursor = LD_GRID.x;
    for (const elemId of rung.elementIds) {
        const node = nodes.get(elemId);
        if (node?.type === 'node:coil') {
            positions.set(elemId, { x: COIL_X_OFFSET, y: ELEMENT_Y });
        } else {
            positions.set(elemId, { x: cursor, y: ELEMENT_Y });
            seriesX.set(elemId, cursor);
            cursor += effectiveWidth(node);
        }
    }

    // Branch members: same x as their anchor, stacked below.
    for (const branch of rung.branches ?? []) {
        const anchorX = seriesX.get(branch.anchorId) ?? positions.get(branch.anchorId)?.x ?? LD_GRID.x;
        branch.elementIds.forEach((memberId, idx) => {
            positions.set(memberId, { x: anchorX, y: BRANCH_FIRST_Y + idx * LD_GRID.y });
        });
    }

    return positions;
}

/** Height of one rung: main row (40..76) or deepest branch row + padding. */
export function rungHeight(rung: Rung): number {
    const branches = rung.branches ?? [];
    const branchCount = Math.max(0, ...branches.map((b) => b.elementIds.length));
    // An open branch (array present, even empty) reserves one member row so its
    // green insertion marker is visible below the anchor (D112 T2.4).
    if (branchCount === 0) {
        return branches.length > 0 ? BRANCH_FIRST_Y + 36 : 76;
    }
    return BRANCH_FIRST_Y + branchCount * LD_GRID.y + 36; // deepest member row + node + padding
}

/** Full-diagram layout: rung tops, per-element positions, rail span. */
export interface LayoutOutput {
    /** Element id → derived position (top-left). */
    positions: Map<string, Point>;
    /** Rung id → vertical offset of the rung container top. */
    rungTops: Map<string, number>;
    /** Rung id → container height (includes branch depth). */
    rungHeights: Map<string, number>;
    /** Power rail geometry (left at x=0, right at RAIL_X_RIGHT). */
    rails: { left: Point; right: Point; height: number };
    /** Total diagram height (bottom of the last rung). */
    totalHeight: number;
}

/**
 * Derive positions for the whole diagram: rungs stack vertically with a
 * 4px gap, each rung's height covers its deepest branch row, rails span
 * the total height.
 */
export function layoutGraph(graph: LdGraph): LayoutOutput {
    const positions = new Map<string, Point>();
    const rungTops = new Map<string, number>();
    const rungHeights = new Map<string, number>();

    let top = 0;
    for (const rung of graph.rungs) {
        rungTops.set(rung.id, top);
        const h = rungHeight(rung);
        rungHeights.set(rung.id, h);
        for (const [id, p] of layoutRung(rung, graph)) {
            positions.set(id, { x: p.x, y: top + p.y });
        }
        top += h + 4;
    }

    return {
        positions,
        rungTops,
        rungHeights,
        rails: {
            left: { x: 0, y: 0 },
            right: { x: RAIL_X_RIGHT, y: 0 },
            height: top,
        },
        totalHeight: top,
    };
}
