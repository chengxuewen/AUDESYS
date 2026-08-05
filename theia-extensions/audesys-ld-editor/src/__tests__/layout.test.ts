/**
 * layoutRung / layoutGraph unit tests — topology-derived layout (D112).
 *
 * RED phase: these tests target `src/model/layout.ts` which does not exist
 * yet. Run now to confirm failure (module not found), then implement
 * layout.ts to GREEN.
 *
 * Layout rules (v2 plan, after 3-reviewer audit):
 *   - Progressive-width cursor: x starts at LD_GRID.x, each element advances
 *     x += effective_width, where effective_width is type-dispatched:
 *       contact  → CONTACT_SIZE + 4            (36+4 = 40)
 *       comparison → COMPARISON_WIDTH + 4      (80+4 = 84)
 *       fb       → FB_WIDTH + LD_GRID.x        (140+40 = 180)
 *       coil     → fixed at COIL_X_OFFSET (600)
 *   - Branch members: x = anchor.x (derived), y = BRANCH_FIRST_Y + idx*40
 *   - layoutGraph: rungs stacked vertically, rung height includes deepest
 *     branch row; rails positioned at x=0 / RAIL_X_RIGHT with total height
 */
import { describe, it, expect } from 'vitest';
import { layoutRung, layoutGraph, LayoutOutput } from '../model/layout';
import { createLdGraph, createRung, createContact, createCoil, createFb, createComparison, createPowerRail, Rung, LdGraph } from '../model/model';
import { ContactType, CoilType, PowerRailSide, ComparisonOperator } from '../model/nodes';
import { LD_GRID, CONTACT_SIZE, COIL_X_OFFSET, BRANCH_FIRST_Y, RAIL_X_RIGHT, RUNG_HEIGHT, RUNG_GROUP_HEIGHT } from '../model/grid';
import { getFbPins } from '../model/fb-catalog';

/** Build a graph with one rung containing the given series element IDs. */
function rungGraph(elementIds: string[], nodes: LdGraph['nodes'], branches?: Rung['branches']): LdGraph {
    const rung = createRung(1, elementIds, 'Main');
    if (branches) rung.branches = branches;
    return { ...createLdGraph(), rungs: [rung], nodes };
}

describe('layoutRung — progressive-width series layout', () => {
    it('places a single contact at x=40, y=40', () => {
        const c = createContact(ContactType.NO, 'IN0');
        const graph = rungGraph([c.id], [c]);

        const pos = layoutRung(graph.rungs[0], graph);

        expect(pos.get(c.id)).toEqual({ x: LD_GRID.x, y: LD_GRID.y });
    });

    it('stacks multiple contacts every 40px (36+4 gap)', () => {
        const c1 = createContact(ContactType.NO, 'IN0');
        const c2 = createContact(ContactType.NO, 'IN1');
        const c3 = createContact(ContactType.NO, 'IN2');
        const graph = rungGraph([c1.id, c2.id, c3.id], [c1, c2, c3]);

        const pos = layoutRung(graph.rungs[0], graph);

        expect(pos.get(c1.id)).toEqual({ x: 40, y: 40 });
        expect(pos.get(c2.id)).toEqual({ x: 80, y: 40 });
        expect(pos.get(c3.id)).toEqual({ x: 120, y: 40 });
    });

    it('offsets a contact after an FB by FB_WIDTH (140) — no overlap (architect C1)', () => {
        const c1 = createContact(ContactType.NO, 'IN0');
        const fb = createFb('TON', getFbPins('TON')!.inputPins, getFbPins('TON')!.outputPins, { x: 0, y: 0 });
        const c2 = createContact(ContactType.NO, 'IN1');
        const graph = rungGraph([c1.id, fb.id, c2.id], [c1, fb, c2]);

        const pos = layoutRung(graph.rungs[0], graph);

        // contact at 40, FB at 80 (occupies 80..220), contact after FB at 260
        expect(pos.get(c1.id)).toEqual({ x: 40, y: 40 });
        expect(pos.get(fb.id)).toEqual({ x: 80, y: 40 });
        expect(pos.get(c2.id)).toEqual({ x: 80 + 140 + 40, y: 40 }); // 260
        expect(pos.get(c2.id)!.x).toBeGreaterThan(pos.get(fb.id)!.x + 140); // no overlap
    });

    it('places a comparison box with its own width (84) (completeness C1)', () => {
        const cmp = createComparison(ComparisonOperator.EQ, 'A', 'B');
        const c = createContact(ContactType.NO, 'IN0');
        const graph = rungGraph([c.id, cmp.id], [c, cmp]);

        const pos = layoutRung(graph.rungs[0], graph);

        expect(pos.get(c.id)).toEqual({ x: 40, y: 40 });
        expect(pos.get(cmp.id)).toEqual({ x: 80, y: 40 });
    });

    it('handles mixed variable-width sequence contact+cmp+fb+contact (architect L2)', () => {
        const c1 = createContact(ContactType.NO, 'IN0');
        const cmp = createComparison(ComparisonOperator.GT, 'A', 'B');
        const fb = createFb('CTU', getFbPins('CTU')!.inputPins, getFbPins('CTU')!.outputPins, { x: 0, y: 0 });
        const c2 = createContact(ContactType.NC, 'IN1');
        const graph = rungGraph([c1.id, cmp.id, fb.id, c2.id], [c1, cmp, fb, c2]);

        const pos = layoutRung(graph.rungs[0], graph);

        expect(pos.get(c1.id)).toEqual({ x: 40, y: 40 });
        expect(pos.get(cmp.id)).toEqual({ x: 80, y: 40 });       // after c1 (40+40)
        expect(pos.get(fb.id)).toEqual({ x: 80 + 84, y: 40 });    // after cmp (80+84=164)
        expect(pos.get(c2.id)).toEqual({ x: 164 + 180, y: 40 });  // after fb (164+180=344)
        // no overlaps
        const xs = [c1.id, cmp.id, fb.id, c2.id].map((id) => pos.get(id)!.x);
        for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    });

    it('fixes the coil at COIL_X_OFFSET (600) regardless of series count', () => {
        const c1 = createContact(ContactType.NO, 'IN0');
        const coil = createCoil(CoilType.Normal, 'OUT0');
        const graph = rungGraph([c1.id, coil.id], [c1, coil]);

        const pos = layoutRung(graph.rungs[0], graph);

        expect(pos.get(coil.id)).toEqual({ x: COIL_X_OFFSET, y: 40 });
        expect(pos.get(c1.id)).toEqual({ x: 40, y: 40 });
    });

    it('stacks branch members below the anchor at anchor.x (y = BRANCH_FIRST_Y + idx*40)', () => {
        const c1 = createContact(ContactType.NO, 'IN0');
        const m1 = createContact(ContactType.NC, 'M0');
        const m2 = createContact(ContactType.NC, 'M1');
        const coil = createCoil(CoilType.Normal, 'OUT0');
        const graph = rungGraph([c1.id, coil.id], [c1, m1, m2, coil]);
        graph.rungs[0].branches = [
            { id: 'br-1', rungId: graph.rungs[0].id, anchorId: c1.id, elementIds: [m1.id, m2.id], x: 0 },
        ];

        const pos = layoutRung(graph.rungs[0], graph);

        // anchor at x=40; members at same x, stacked below
        expect(pos.get(c1.id)).toEqual({ x: 40, y: 40 });
        expect(pos.get(m1.id)).toEqual({ x: 40, y: BRANCH_FIRST_Y });
        expect(pos.get(m2.id)).toEqual({ x: 40, y: BRANCH_FIRST_Y + 40 });
    });
});

describe('layoutGraph — rung stacking + rails', () => {
    it('stacks 2 rungs vertically and positions rails with total height (sdd-tester HIGH)', () => {
        const c1 = createContact(ContactType.NO, 'IN0');
        const rung1 = createRung(1, [c1.id], 'Main');
        const rung2 = createRung(2, []);
        const graph: LdGraph = {
            ...createLdGraph(),
            nodes: [c1, createPowerRail(PowerRailSide.Left), createPowerRail(PowerRailSide.Right)],
            rungs: [rung1, rung2],
        };

        const out: LayoutOutput = layoutGraph(graph);

        // rung1 top at 0, rung2 top after rung1 height + gap
        const rung1Top = out.rungTops.get(rung1.id)!;
        const rung2Top = out.rungTops.get(rung2.id)!;
        expect(rung1Top).toBe(0);
        expect(rung2Top).toBeGreaterThanOrEqual(RUNG_GROUP_HEIGHT + 4);
        // element in rung1: y = rung1Top + 40
        expect(out.positions.get(c1.id)).toEqual({ x: 40, y: 40 });
        // rails span total height
        expect(out.rails.left).toEqual({ x: 0, y: 0 });
        expect(out.rails.right.x).toBe(RAIL_X_RIGHT);
        expect(out.rails.height).toBeGreaterThanOrEqual(rung2Top + RUNG_HEIGHT);
    });

    it('rung height grows with branch depth (deepest member row)', () => {
        const c1 = createContact(ContactType.NO, 'IN0');
        const m1 = createContact(ContactType.NC, 'M0');
        const m2 = createContact(ContactType.NC, 'M1');
        const coil = createCoil(CoilType.Normal, 'OUT0');
        const rung1 = createRung(1, [c1.id, coil.id], 'Main');
        rung1.branches = [{ id: 'br-1', rungId: rung1.id, anchorId: c1.id, elementIds: [m1.id, m2.id], x: 0 }];
        const rung2 = createRung(2, []);
        const graph: LdGraph = {
            ...createLdGraph(),
            nodes: [c1, m1, m2, coil],
            rungs: [rung1, rung2],
        };

        const out: LayoutOutput = layoutGraph(graph);

        // rung1 with 2 branch members: height must cover BRANCH_FIRST_Y + 2*40 + node
        // rung2 must start below rung1's full height
        const rung1H = out.rungHeights.get(rung1.id)!;
        const rung2Top = out.rungTops.get(rung2.id)!;
        expect(rung1H).toBeGreaterThanOrEqual(BRANCH_FIRST_Y + 2 * 40 + 36);
        expect(rung2Top).toBeGreaterThanOrEqual(rung1H + 4);
    });
});
