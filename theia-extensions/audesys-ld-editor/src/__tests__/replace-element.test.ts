/**
 * Element replacement tests — changeContactType / changeCoilType (P1-3).
 * SDD: LD-REPLACE (plan C4) — switching a contact NO ↔ NC ↔ P ↔ N or a
 * coil Normal ↔ Negated ↔ Set ↔ Reset MUST preserve the variable name
 * (and any element comment).
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

describe('changeContactType', () => {
    it('switches NO → NC → P → N preserving the variable name', () => {
        const { handler, graph, contactId } = graphWithContactAndCoil();
        const contact = graph.nodes.find((n) => n.id === contactId) as { variableName: string };
        const originalName = contact.variableName;

        // Act — cycle through every contact type
        let next = handler.changeContactType(graph, { elementId: contactId, newType: ContactType.NC });
        next = handler.changeContactType(next, { elementId: contactId, newType: ContactType.P });
        next = handler.changeContactType(next, { elementId: contactId, newType: ContactType.N });
        next = handler.changeContactType(next, { elementId: contactId, newType: ContactType.NO });

        // Assert — type cycled, variable name untouched
        const updated = next.nodes.find((n) => n.id === contactId);
        expect(updated).toMatchObject({ contactType: ContactType.NO, variableName: originalName });
    });

    it('preserves the element comment when replacing', () => {
        const { handler, graph, contactId } = graphWithContactAndCoil();
        const annotated = handler.setElementComment(graph, { elementId: contactId, comment: 'Start button' });

        const next = handler.changeContactType(annotated, { elementId: contactId, newType: ContactType.NC });

        expect(next.nodes.find((n) => n.id === contactId)).toMatchObject({
            contactType: ContactType.NC,
            comment: 'Start button',
        });
    });

    it('is idempotent when the type is unchanged', () => {
        const { handler, graph, contactId } = graphWithContactAndCoil();

        expect(handler.changeContactType(graph, { elementId: contactId, newType: ContactType.NO })).toBe(graph);
    });
});

describe('changeCoilType', () => {
    it('switches Normal → Negated → Set → Reset preserving the variable name', () => {
        const { handler, graph, coilId } = graphWithContactAndCoil();
        const coil = graph.nodes.find((n) => n.id === coilId) as { variableName: string };
        const originalName = coil.variableName;

        // Act — cycle through every coil type
        let next = handler.changeCoilType(graph, { elementId: coilId, newType: CoilType.Negated });
        next = handler.changeCoilType(next, { elementId: coilId, newType: CoilType.Set });
        next = handler.changeCoilType(next, { elementId: coilId, newType: CoilType.Reset });
        next = handler.changeCoilType(next, { elementId: coilId, newType: CoilType.Normal });

        // Assert — type cycled, variable name untouched
        const updated = next.nodes.find((n) => n.id === coilId);
        expect(updated).toMatchObject({ coilType: CoilType.Normal, variableName: originalName });
    });

    it('preserves the element comment when replacing', () => {
        const { handler, graph, coilId } = graphWithContactAndCoil();
        const annotated = handler.setElementComment(graph, { elementId: coilId, comment: 'Pump relay' });

        const next = handler.changeCoilType(annotated, { elementId: coilId, newType: CoilType.Set });

        expect(next.nodes.find((n) => n.id === coilId)).toMatchObject({
            coilType: CoilType.Set,
            comment: 'Pump relay',
        });
    });

    it('is idempotent when the type is unchanged', () => {
        const { handler, graph, coilId } = graphWithContactAndCoil();

        expect(handler.changeCoilType(graph, { elementId: coilId, newType: CoilType.Normal })).toBe(graph);
    });

    it('throws for non-coil elements', () => {
        const { handler, graph, contactId } = graphWithContactAndCoil();

        expect(() => handler.changeCoilType(graph, { elementId: contactId, newType: CoilType.Set }))
            .toThrow(/Not a coil/);
    });

    it('throws for unknown elements', () => {
        const { handler, graph } = graphWithContactAndCoil();

        expect(() => handler.changeCoilType(graph, { elementId: 'nope', newType: CoilType.Set }))
            .toThrow(/Not a coil/);
    });
});

describe('replacement persistence (round-trip)', () => {
    it('persists replaced contact and coil types through JSON', () => {
        const { handler, graph, contactId, coilId } = graphWithContactAndCoil();
        const replacedContact = handler.changeContactType(graph, { elementId: contactId, newType: ContactType.NC });
        const replacedCoil = handler.changeCoilType(replacedContact, { elementId: coilId, newType: CoilType.Set });

        // Act — serialize → deserialize
        const restored = fromJSON(toJSON(replacedCoil));

        // Assert — types survive, variable names survive
        expect(restored.nodes.find((n) => n.id === contactId)).toMatchObject({
            contactType: ContactType.NC,
            variableName: 'IN0',
        });
        expect(restored.nodes.find((n) => n.id === coilId)).toMatchObject({
            coilType: CoilType.Set,
            variableName: 'OUT0',
        });
    });
});
