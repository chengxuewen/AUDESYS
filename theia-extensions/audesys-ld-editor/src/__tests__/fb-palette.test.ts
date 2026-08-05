/**
 * FB palette tests — addFb for every catalog FB type (P0-2).
 * SDD: LD-FB (plan B1/B2/B4) — pins come from the fb-catalog, the block
 * auto-connects predecessor→EN and ENO→successor with pin-anchored wires.
 */
import { describe, it, expect } from 'vitest';

import { LdOperationHandler } from '../backend/ld-operation-handler';
import { createLdGraph, LdGraph } from '../model/model';
import { ContactType, CoilType } from '../model/nodes';
import { FB_TYPES, FbType } from '../model/fb-catalog';
import { COIL_X_OFFSET } from '../model/grid';

/** Fresh handler + rung with one contact at x=40 (so FB has a predecessor). */
function graphWithContact(): { handler: LdOperationHandler; graph: LdGraph; rungId: string } {
    const handler = new LdOperationHandler(() => JSON.stringify({ instructions: [] }));
    const graph = handler.addRung(createLdGraph());
    const rungId = graph.rungs[0].id;
    const withContact = handler.addContact(graph, { position: { x: 40, y: 40 }, type: ContactType.NO, rungId });
    return { handler, graph: withContact, rungId };
}

describe('fb palette catalog', () => {
    it('covers timers, counters, comparison and arithmetic', () => {
        expect(FB_TYPES).toEqual(expect.arrayContaining(['TON', 'TOF', 'TP']));
        expect(FB_TYPES).toEqual(expect.arrayContaining(['CTU', 'CTD']));
        expect(FB_TYPES).toEqual(expect.arrayContaining(['EQ', 'GT', 'LT', 'GE', 'LE', 'NE']));
        expect(FB_TYPES).toEqual(expect.arrayContaining(['ADD', 'SUB', 'MUL', 'DIV', 'MOD']));
    });

    it.each<FbType>(FB_TYPES)('addFb creates a %s block with EN/ENO pins and wires', (fbType) => {
        // Arrange
        const { handler, graph, rungId } = graphWithContact();

        // Act — place to the right of the contact
        const next = handler.addFb(graph, { position: { x: 200, y: 40 }, fbType, rungId });

        // Assert
        const fb = next.nodes.find((n) => n.type === 'node:fb');
        expect(fb).toBeDefined();
        expect(fb).toMatchObject({ type: 'node:fb', fbType });
        const fbNode = fb as { inputPins: Array<{ name: string }>; outputPins: Array<{ name: string }> };
        expect(fbNode.inputPins[0].name).toBe('EN');
        expect(fbNode.outputPins[0].name).toBe('ENO');
        // rung membership
        expect(next.rungs[0].elementIds).toContain(fb?.id);
        // auto-connect: contact → EN and ENO → coil zone (no successor → coil/rail)
        const enWire = next.edges.find((e) => e.targetId === fb?.id && e.targetPin === 'EN');
        expect(enWire).toBeDefined();
        expect(enWire?.sourceId).toBe(next.rungs[0].elementIds[0]);
        const enoWire = next.edges.find((e) => e.sourceId === fb?.id && e.sourcePin === 'ENO');
        expect(enoWire).toBeDefined();
    });

    it('rejects an unknown FB type', () => {
        // Arrange
        const { handler, graph, rungId } = graphWithContact();

        // Act / Assert
        expect(() => handler.addFb(graph, { position: { x: 200, y: 40 }, fbType: 'NOT_A_FB', rungId }))
            .toThrow(/Unknown FB type/);
    });

    it('sizes the block height to fit its pins', () => {
        // Arrange — CTU has 3 inputs + EN = 4 rows
        const { handler, graph, rungId } = graphWithContact();

        // Act
        const next = handler.addFb(graph, { position: { x: 200, y: 40 }, fbType: 'CTU', rungId });
        const fb = next.nodes.find((n) => n.type === 'node:fb');

        // Assert — 4 rows × 30 + padding
        expect(fb?.size.height).toBeGreaterThanOrEqual(120);
    });

    it('places the FB before an existing coil (left-to-right order)', () => {
        // Arrange — contact + coil first, FB inserted between
        const { handler, graph, rungId } = graphWithContact();
        const withCoil = handler.addCoil(graph, { position: { x: COIL_X_OFFSET, y: 40 }, type: CoilType.Normal, rungId });

        // Act — topology slot 1 = between the contact and the coil
        const next = handler.addFb(withCoil, { insertIndex: 1, fbType: 'ADD', rungId });

        // Assert
        const ids = next.rungs[0].elementIds;
        const fbId = ids.find((id) => next.nodes.find((n) => n.id === id)?.type === 'node:fb');
        expect(ids.indexOf(fbId!)).toBeGreaterThan(0);
        expect(ids.indexOf(fbId!)).toBeLessThan(ids.indexOf(ids[ids.length - 1]));
        // ENO connects to the coil
        expect(next.edges.some((e) => e.sourceId === fbId && e.sourcePin === 'ENO' && e.targetId === withCoil.rungs[0].elementIds[1]))
            .toBe(true);
    });
});
