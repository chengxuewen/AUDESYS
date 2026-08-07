/**
 * A4: copy/paste + drag-replace handler tests.
 * pasteElements clones element definitions into a topology slot and rewires;
 * replaceElement swaps an element in place keeping its connections (CODESYS
 * drag-drop style). Branch members degrade to series copies (v3 semantics).
 */
import { describe, it, expect } from 'vitest';

import { LdOperationHandler } from '../backend/ld-operation-handler';
import { createLdGraph, LdGraph } from '../model/model';
import { ContactType, CoilType, FbPlaceholderNode, PowerRailSide } from '../model/nodes';

function graphWithRung(): { handler: LdOperationHandler; graph: LdGraph; rungId: string } {
    const handler = new LdOperationHandler(() => JSON.stringify({ instructions: [] }));
    const graph = handler.addRung(createLdGraph());
    return { handler, graph, rungId: graph.rungs[0].id };
}

/** Rung with contact c1 + coil k1 wired. Returns the built graph + ids. */
function graphWithChain(): { handler: LdOperationHandler; graph: LdGraph; rungId: string; contactId: string; coilId: string } {
    const { handler, graph: g0, rungId } = graphWithRung();
    const g1 = handler.addContact(g0, { type: ContactType.NO, rungId, insertIndex: 0 });
    const contactId = g1.rungs[0].elementIds[0];
    const g2 = handler.addCoil(g1, { rungId, variableName: 'OUT0' });
    const coilId = g2.rungs[0].elementIds[g2.rungs[0].elementIds.length - 1];
    return { handler, graph: g2, rungId, contactId, coilId };
}

describe('pasteElements', () => {
    it('pastes a contact copy at the slot with a NEW id and rewired chain', () => {
        const { handler, graph, rungId, contactId } = graphWithChain();

        const pasted = handler.pasteElements(graph, {
            elementIds: [contactId],
            rungId,
            insertIndex: 1,
        });

        // Original + pasted copy, distinct ids
        const contacts = pasted.nodes.filter((n) => n.type === 'node:contact');
        expect(contacts).toHaveLength(2);
        expect(contacts[0].id).not.toBe(contacts[1].id);
        expect(pasted.nodes.filter((n) => n.type === 'node:coil')).toHaveLength(1);

        // Same variable name copied
        const orig = contacts.find((c) => c.id === contactId) as { variableName: string };
        const copy = contacts.find((c) => c.id !== contactId) as { variableName: string };
        expect(copy.variableName).toBe(orig.variableName);

        // Rung chain: 3 series elements (2 contacts + coil), fully wired
        const rung = pasted.rungs.find((r) => r.id === rungId)!;
        expect(rung.elementIds).toHaveLength(3);
        const seriesEdges = pasted.edges.filter((e) =>
            rung.elementIds.includes(e.sourceId) && rung.elementIds.includes(e.targetId));
        // contact→copy + copy→coil (original contact→coil wire is rebuilt too)
        expect(seriesEdges.length).toBeGreaterThanOrEqual(2);
    });

    it('copies contact type (NC stays NC)', () => {
        const { handler, graph, rungId } = graphWithRung();
        const g1 = handler.addContact(graph, { type: ContactType.NC, rungId, insertIndex: 0 });
        const contactId = g1.rungs[0].elementIds[0];

        const pasted = handler.pasteElements(g1, { elementIds: [contactId], rungId, insertIndex: 0 });
        const copies = pasted.nodes.filter((n) => n.type === 'node:contact');
        expect(copies.every((c) => (c as { contactType: ContactType }).contactType === ContactType.NC)).toBe(true);
    });

    it('copies coil type and variable name', () => {
        const { handler, graph, rungId, contactId } = graphWithChain();
        const g2 = handler.changeCoilType(graph, {
            elementId: graph.nodes.find((n) => n.type === 'node:coil')!.id,
            newType: CoilType.Set,
        });
        const coilId = g2.nodes.find((n) => n.type === 'node:coil')!.id;

        const pasted = handler.pasteElements(g2, { elementIds: [coilId], rungId, insertIndex: 1 });
        const coils = pasted.nodes.filter((n) => n.type === 'node:coil');
        expect(coils).toHaveLength(2);
        expect(coils.every((c) => (c as { coilType: CoilType }).coilType === CoilType.Set)).toBe(true);
    });

    it('pastes FB definitions (type + pins) as a fresh node', () => {
        const { handler, graph, rungId } = graphWithRung();
        const fb = handler.addFb(graph, { rungId, fbType: 'TON', insertIndex: 0 });
        const fbId = fb.nodes.find((n) => n.type === 'node:fb')!.id;

        const pasted = handler.pasteElements(fb, { elementIds: [fbId], rungId, insertIndex: 1 });
        const fbs = pasted.nodes.filter((n) => n.type === 'node:fb');
        expect(fbs).toHaveLength(2);
        expect(fbs.every((f) => (f as FbPlaceholderNode).fbType === 'TON')).toBe(true);
        expect((fbs[1] as FbPlaceholderNode).inputPins.length).toBeGreaterThan(0);
    });

    it('throws when nothing copyable is given', () => {
        const { handler, graph, rungId } = graphWithRung();
        expect(() =>
            handler.pasteElements(graph, { elementIds: ['does-not-exist'], rungId, insertIndex: 0 }))
            .toThrow('Nothing to paste');
    });
});

describe('replaceElement', () => {
    it('swaps a contact NO→NC in place keeping its id and connections', () => {
        const { handler, graph, contactId } = graphWithChain();
        const edgesBefore = graph.edges.filter((e) => e.sourceId === contactId || e.targetId === contactId);

        const replaced = handler.replaceElement(graph, {
            targetId: contactId,
            replacement: {
                ...graph.nodes.find((n) => n.id === contactId)!,
                contactType: ContactType.NC,
                id: 'ignored',
            },
        });

        const node = replaced.nodes.find((n) => n.id === contactId) as { contactType: ContactType };
        expect(node).toBeDefined();
        expect(node.contactType).toBe(ContactType.NC);
        // Id preserved → wires survive untouched
        expect(replaced.edges.filter((e) => e.sourceId === contactId || e.targetId === contactId)).toHaveLength(edgesBefore.length);
    });

    it('rejects type-mismatched replacements', () => {
        const { handler, graph, contactId, rungId } = graphWithChain();
        const coil = handler.addCoil(graph, { rungId, variableName: 'OUT1' }).nodes
            .find((n) => n.type === 'node:coil')!;
        expect(() =>
            handler.replaceElement(graph, { targetId: contactId, replacement: coil }))
            .toThrow('type mismatch');
    });

    it('throws for missing targets', () => {
        const { handler, graph } = graphWithRung();
        expect(() =>
            handler.replaceElement(graph, {
                targetId: 'nope',
                replacement: graph.nodes.find((n) => n.type === 'node:contact')!,
            })).toThrow('Element not found');
    });
});
