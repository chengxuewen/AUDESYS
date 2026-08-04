/**
 * Annotation tests — setRungTitle / setRungComment / setElementComment (P1-1).
 * SDD: LD-ANNOTATION (plan D1/D2) — network title + network comment on the
 * rung, element comment on contacts/coils; all persist through JSON round-trip.
 */
import { describe, it, expect } from 'vitest';

import { LdOperationHandler } from '../backend/ld-operation-handler';
import { createLdGraph, LdGraph } from '../model/model';
import { ContactType, CoilType } from '../model/nodes';
import { fromJSON, toJSON } from '../model/serialization';
import { COIL_X_OFFSET } from '../model/grid';

interface Fixture {
    handler: LdOperationHandler;
    graph: LdGraph;
    contactId: string;
    coilId: string;
    rungId: string;
}

function graphWithContactAndCoil(): Fixture {
    const handler = new LdOperationHandler();
    const graph = handler.addRung(createLdGraph());
    const rungId = graph.rungs[0].id;
    const withContact = handler.addContact(graph, { position: { x: 40, y: 40 }, type: ContactType.NO, rungId });
    const contactId = withContact.rungs[0].elementIds[0];
    const withCoil = handler.addCoil(withContact, { position: { x: COIL_X_OFFSET, y: 40 }, type: CoilType.Normal, rungId });
    const coilId = withCoil.rungs[0].elementIds[1];
    return { handler, graph: withCoil, contactId, coilId, rungId };
}

describe('setRungTitle', () => {
    it('sets the rung network title', () => {
        const { handler, graph, rungId } = graphWithContactAndCoil();

        const next = handler.setRungTitle(graph, { rungId, title: 'Motor start circuit' });

        expect(next.rungs[0].title).toBe('Motor start circuit');
        expect(next.rungs[0].id).toBe(rungId);
    });

    it('trims whitespace', () => {
        const { handler, graph, rungId } = graphWithContactAndCoil();

        const next = handler.setRungTitle(graph, { rungId, title: '  Motor start  ' });

        expect(next.rungs[0].title).toBe('Motor start');
    });

    it('clears the title with an empty string', () => {
        const { handler, graph, rungId } = graphWithContactAndCoil();
        const titled = handler.setRungTitle(graph, { rungId, title: 'Motor start' });

        const next = handler.setRungTitle(titled, { rungId, title: '   ' });

        expect(next.rungs[0].title).toBeUndefined();
    });

    it('is idempotent when the title is unchanged', () => {
        const { handler, graph, rungId } = graphWithContactAndCoil();
        const titled = handler.setRungTitle(graph, { rungId, title: 'Motor start' });

        expect(handler.setRungTitle(titled, { rungId, title: 'Motor start' })).toBe(titled);
    });

    it('throws for unknown rungs', () => {
        const { handler, graph } = graphWithContactAndCoil();

        expect(() => handler.setRungTitle(graph, { rungId: 'nope', title: 'X' })).toThrow(/Rung not found/);
    });
});

describe('setRungComment', () => {
    it('sets the rung network comment', () => {
        const { handler, graph, rungId } = graphWithContactAndCoil();

        const next = handler.setRungComment(graph, { rungId, comment: 'Starts the pump' });

        expect(next.rungs[0].comment).toBe('Starts the pump');
    });

    it('clears the comment with an empty string', () => {
        const { handler, graph, rungId } = graphWithContactAndCoil();
        const commented = handler.setRungComment(graph, { rungId, comment: 'Starts the pump' });

        const next = handler.setRungComment(commented, { rungId, comment: '' });

        expect(next.rungs[0].comment).toBeUndefined();
    });

    it('is idempotent when the comment is unchanged', () => {
        const { handler, graph, rungId } = graphWithContactAndCoil();

        // addRung seeds the first rung with comment 'Main' — same value = no-op.
        expect(handler.setRungComment(graph, { rungId, comment: 'Main' })).toBe(graph);
    });
});


describe('setElementComment', () => {
    it('sets a contact comment', () => {
        const { handler, graph, contactId } = graphWithContactAndCoil();

        const next = handler.setElementComment(graph, { elementId: contactId, comment: 'Start button' });

        expect(next.nodes.find((n) => n.id === contactId)).toMatchObject({ comment: 'Start button' });
    });

    it('sets a coil comment and preserves the variable name', () => {
        const { handler, graph, coilId } = graphWithContactAndCoil();

        const next = handler.setElementComment(graph, { elementId: coilId, comment: 'Pump relay' });

        expect(next.nodes.find((n) => n.id === coilId)).toMatchObject({
            comment: 'Pump relay',
            variableName: 'OUT0',
        });
    });

    it('clears an element comment with an empty string', () => {
        const { handler, graph, contactId } = graphWithContactAndCoil();
        const commented = handler.setElementComment(graph, { elementId: contactId, comment: 'Start button' });

        const next = handler.setElementComment(commented, { elementId: contactId, comment: '  ' });

        expect(next.nodes.find((n) => n.id === contactId)?.comment).toBeUndefined();
    });

    it('is idempotent when the comment is unchanged', () => {
        const { handler, graph, rungId } = graphWithContactAndCoil();

        // addRung seeds the first rung with comment 'Main' — same value = no-op.
        expect(handler.setRungComment(graph, { rungId, comment: 'Main' })).toBe(graph);
    });

    it('throws for non-contact/coil elements', () => {
        const { handler, graph } = graphWithContactAndCoil();
        const rail = graph.nodes.find((n) => n.type === 'node:powerrail');

        expect(() => handler.setElementComment(graph, { elementId: rail!.id, comment: 'x' }))
            .toThrow(/Not a contact or coil/);
    });

    it('throws for unknown elements', () => {
        const { handler, graph } = graphWithContactAndCoil();

        expect(() => handler.setElementComment(graph, { elementId: 'nope', comment: 'x' }))
            .toThrow(/Not a contact or coil/);
    });
});

describe('annotation persistence (round-trip)', () => {
    it('persists rung title, rung comment and element comments through JSON', () => {
        const { handler, graph, contactId, rungId } = graphWithContactAndCoil();
        const annotated = handler.setRungTitle(graph, { rungId, title: 'Motor start' });
        const next = handler.setRungComment(annotated, { rungId, comment: 'Starts the pump' });
        const full = handler.setElementComment(next, { elementId: contactId, comment: 'Start button' });

        // Act — serialize → deserialize
        const restored = fromJSON(toJSON(full));

        // Assert — all annotations survive the round trip
        expect(restored.rungs[0].title).toBe('Motor start');
        expect(restored.rungs[0].comment).toBe('Starts the pump');
        expect(restored.nodes.find((n) => n.id === contactId)).toMatchObject({ comment: 'Start button' });
        // And the rest of the graph is intact
        expect(restored.rungs.length).toBe(1);
        expect(restored.nodes.length).toBe(graph.nodes.length);
    });

    it('round-trips a graph without annotations unchanged', () => {
        const { handler, graph, rungId } = graphWithContactAndCoil();
        // addRung seeds the first rung with 'Main' — clear it first.
        const cleared = handler.setRungComment(graph, { rungId, comment: '' });

        const restored = fromJSON(toJSON(cleared));

        expect(restored.rungs[0].title).toBeUndefined();
        expect(restored.rungs[0].comment).toBeUndefined();
        expect(restored.nodes.every((n) => !('comment' in n))).toBe(true);
});
});
