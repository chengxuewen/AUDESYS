/**
 * LdOperationHandler unit tests — CRUD, wiring, validation, compile (mocked bridge).
 * The compile function is injected, so no napi-rs/theia-bridge module is loaded.
 */
import { describe, it, expect } from 'vitest';

import { LdOperationHandler } from '../backend/ld-operation-handler';
import { createLdGraph, createContact, createRung, LdGraph } from '../model/model';
import { layoutRung } from '../model/layout';
import { ContactType, CoilType, PowerRailSide } from '../model/nodes';
import { COIL_X_OFFSET, RAIL_X_RIGHT } from '../model/grid';

/** Fresh handler + graph with one rung (auto power rails included). */
function graphWithRung(): { handler: LdOperationHandler; graph: LdGraph; rungId: string } {
    const handler = new LdOperationHandler(() => JSON.stringify({ instructions: [] }));
    const graph = handler.addRung(createLdGraph());
    return { handler, graph, rungId: graph.rungs[0].id };
}

/** Rung with one NO contact at x=40. */
function graphWithContact(): { handler: LdOperationHandler; graph: LdGraph; contactId: string; rungId: string } {
    const { handler, graph } = graphWithRung();
    const rungId = graph.rungs[0].id;
    const next = handler.addContact(graph, {
        position: { x: 40, y: 40 },
        type: ContactType.NO,
        rungId,
    });
    const contactId = next.rungs[0].elementIds[0];
    return { handler, graph: next, contactId, rungId };
}

describe('addContact', () => {
    it('adds a contact to the rung with position snapped to the 40px grid', () => {
        // Arrange
        const { handler, graph, rungId } = graphWithRung();

        // Act — 47/33 must snap to 40/40
        const next = handler.addContact(graph, {
            position: { x: 47, y: 33 },
            type: ContactType.NO,
            rungId,
        });

        // Assert — topology (D112): position is derived by layoutRung, not stored.
        const contact = next.nodes.find((n) => n.type === 'node:contact');
        expect(contact).toBeDefined();
        expect(next.rungs[0].elementIds).toContain(contact?.id);
        const pos = layoutRung(next.rungs[0], next).get(contact!.id);
        expect(pos).toEqual({ x: 40, y: 40 });
    });

    it('auto-connects the first contact to both power rails', () => {
        // Arrange
        const { handler, graph, rungId } = graphWithRung();

        // Act
        const next = handler.addContact(graph, {
            position: { x: 40, y: 40 },
            type: ContactType.NO,
            rungId,
        });

        // Assert — wire left-rail→contact and contact→right-rail
        expect(next.edges.length).toBe(2);
        const contactId = next.rungs[0].elementIds[0];
        expect(next.edges.some((e) => e.targetId === contactId)).toBe(true);
        expect(next.edges.some((e) => e.sourceId === contactId)).toBe(true);
    });

    it('rejects a contact placed right of the coil', () => {
        // Arrange
        const { handler, graph, rungId } = graphWithContact();
        const withCoil = handler.addCoil(graph, {
            position: { x: COIL_X_OFFSET, y: 40 },
            type: CoilType.Normal,
            rungId,
        });

        // Act / Assert
        expect(() =>
            handler.addContact(withCoil, {
                position: { x: COIL_X_OFFSET + 40, y: 40 },
                type: ContactType.NO,
                rungId,
            }),
        ).toThrow(/left of the coil/);
    });
});

describe('addCoil', () => {
    it('adds a coil at COIL_X_OFFSET and wires contact→coil→right rail', () => {
        // Arrange
        const { handler, graph, contactId, rungId } = graphWithContact();
        const edgesBefore = graph.edges.length;

        // Act
        const next = handler.addCoil(graph, {
            position: { x: COIL_X_OFFSET, y: 40 },
            type: CoilType.Normal,
            rungId,
        });

        // Assert — topology: coil pinned to the coil zone by layoutRung.
        const coil = next.nodes.find((n) => n.type === 'node:coil');
        expect(coil).toBeDefined();
        const pos = layoutRung(next.rungs[0], next).get(coil!.id);
        expect(pos?.x).toBe(COIL_X_OFFSET);
        expect(next.rungs[0].elementIds).toEqual([contactId, coil?.id]);
        // two new wires: contact→coil and coil→right rail
        expect(next.edges.length).toBe(edgesBefore + 2);
        expect(next.edges.some((e) => e.sourceId === contactId && e.targetId === coil?.id)).toBe(true);
    });

    it('rejects a coil when the rung has no contacts', () => {
        // Arrange
        const { handler, graph, rungId } = graphWithRung();

        // Act / Assert
        expect(() =>
            handler.addCoil(graph, { position: { x: COIL_X_OFFSET, y: 40 }, type: CoilType.Normal, rungId }),
        ).toThrow(/at least one contact/);
    });
});

describe('addRung', () => {
    it('creates the first rung with automatic power rails', () => {
        // Arrange
        const handler = new LdOperationHandler();
        const graph = createLdGraph();

        // Act
        const next = handler.addRung(graph);

        // Assert
        expect(next.rungs.length).toBe(1);
        expect(next.rungs[0].rungNumber).toBe(1);
        const rails = next.nodes.filter((n) => n.type === 'node:powerrail');
        expect(rails.length).toBe(2);
        const left = rails.find((n) => (n as { side: PowerRailSide }).side === PowerRailSide.Left);
        const right = rails.find((n) => (n as { side: PowerRailSide }).side === PowerRailSide.Right);
        expect(left?.position.x).toBe(0);
        expect(right?.position.x).toBe(RAIL_X_RIGHT);
    });

    it('adds subsequent rungs without duplicating rails', () => {
        // Arrange
        const { handler, graph } = graphWithRung();

        // Act
        const next = handler.addRung(graph);

        // Assert
        expect(next.rungs.length).toBe(2);
        expect(next.rungs[1].rungNumber).toBe(2);
        expect(next.nodes.filter((n) => n.type === 'node:powerrail').length).toBe(2);
    });
});

describe('deleteElement', () => {
    it('removes a node and cascade-removes its connected edges', () => {
        // Arrange
        const { handler, graph, contactId } = graphWithContact();
        const edgesBefore = graph.edges.length;
        expect(edgesBefore).toBeGreaterThan(0);

        // Act
        const next = handler.deleteElement(graph, { elementId: contactId });

        // Assert
        expect(next.nodes.find((n) => n.id === contactId)).toBeUndefined();
        expect(next.edges.length).toBe(0);
        expect(next.rungs[0].elementIds).not.toContain(contactId);
    });

    it('throws for an unknown element', () => {
        // Arrange
        const { handler, graph } = graphWithRung();

        // Act / Assert
        expect(() => handler.deleteElement(graph, { elementId: 'nope' })).toThrow(/not found/);
    });
});

describe('connectWire', () => {
    it('creates a wire between two nodes', () => {
        // Arrange — two standalone contacts, no pre-existing wire
        const handler = new LdOperationHandler();
        const graph = createLdGraph();
        const a = createContact(ContactType.NO, 'A', { x: 40, y: 40 });
        const b = createContact(ContactType.NO, 'B', { x: 120, y: 40 });
        graph.nodes.push(a, b);
        graph.rungs.push(createRung(1, [a.id, b.id]));

        // Act
        const next = handler.connectWire(graph, { sourceId: a.id, targetId: b.id });

        // Assert
        expect(next.edges.length).toBe(1);
        expect(next.edges[0]).toMatchObject({
            type: 'edge:wire',
            sourceId: a.id,
            targetId: b.id,
        });
    });

    it('is idempotent for duplicate wires', () => {
        // Arrange
        const { handler, graph, contactId, rungId } = graphWithContact();
        const withCoil = handler.addCoil(graph, {
            position: { x: COIL_X_OFFSET, y: 40 },
            type: CoilType.Normal,
            rungId,
        });
        const existing = withCoil.edges.find((e) => e.sourceId === contactId);
        expect(existing).toBeDefined();

        // Act
        const next = handler.connectWire(withCoil, {
            sourceId: contactId,
            targetId: existing!.targetId,
        });

        // Assert — same reference, no duplicate
        expect(next).toBe(withCoil);
    });

    it('rejects direct power-rail connections (short circuit)', () => {
        // Arrange
        const { handler, graph } = graphWithRung();
        const left = graph.nodes.find((n) => n.type === 'node:powerrail' && n.position.x === 0);
        const right = graph.nodes.find((n) => n.type === 'node:powerrail' && n.position.x !== 0);

        // Act / Assert
        expect(() => handler.connectWire(graph, { sourceId: left!.id, targetId: right!.id }))
            .toThrow(/Short circuit/);
    });

    it('rejects connecting from a coil output', () => {
        // Arrange
        const { handler, graph, contactId, rungId } = graphWithContact();
        const withCoil = handler.addCoil(graph, {
            position: { x: COIL_X_OFFSET, y: 40 },
            type: CoilType.Normal,
            rungId,
        });
        const coilId = withCoil.rungs[0].elementIds.find((id) => id !== contactId);

        // Act / Assert
        expect(() => handler.connectWire(withCoil, { sourceId: coilId!, targetId: contactId }))
            .toThrow(/coil output/);
    });
});

describe('changeContactType', () => {
    it('switches NO ↔ NC', () => {
        // Arrange
        const { handler, graph, contactId } = graphWithContact();

        // Act
        const toNc = handler.changeContactType(graph, { elementId: contactId, newType: ContactType.NC });
        const backToNo = handler.changeContactType(toNc, { elementId: contactId, newType: ContactType.NO });

        // Assert
        expect(toNc.nodes.find((n) => n.id === contactId)).toMatchObject({ contactType: ContactType.NC });
        expect(backToNo.nodes.find((n) => n.id === contactId)).toMatchObject({ contactType: ContactType.NO });
    });

    it('is idempotent when the type is unchanged', () => {
        // Arrange
        const { handler, graph, contactId } = graphWithContact();

        // Act
        const next = handler.changeContactType(graph, { elementId: contactId, newType: ContactType.NO });

        // Assert
        expect(next).toBe(graph);
    });

    it('throws for non-contact elements', () => {
        // Arrange
        const { handler, graph, rungId } = graphWithContact();
        const withCoil = handler.addCoil(graph, {
            position: { x: COIL_X_OFFSET, y: 40 },
            type: CoilType.Normal,
            rungId,
        });
        const coilId = withCoil.rungs[0].elementIds[1];

        // Act / Assert
        expect(() => handler.changeContactType(withCoil, { elementId: coilId, newType: ContactType.NC }))
            .toThrow(/Not a contact/);
    });
});

describe('validate', () => {
    it('accepts a well-formed rung (contact + coil + rails)', () => {
        // Arrange
        const { handler, graph, rungId } = graphWithContact();
        const complete = handler.addCoil(graph, {
            position: { x: COIL_X_OFFSET, y: 40 },
            type: CoilType.Normal,
            rungId,
        });

        // Act
        const result = handler.validate(complete);

        // Assert
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('warns (not errors) on an empty rung — legal intermediate state', () => {
        // Arrange
        const { handler, graph } = graphWithRung();

        // Act
        const result = handler.validate(graph);

        // Assert: empty rung is non-blocking (valid=true) and surfaces as a warning
        expect(result.valid).toBe(true);
        expect(result.warnings?.some((w) => w.includes('Empty rung'))).toBe(true);
    });
});

describe('compile', () => {
    function completeGraph(): { handler: LdOperationHandler; graph: LdGraph; calls: string[] } {
        const calls: string[] = [];
        const handler = new LdOperationHandler((source) => {
            calls.push(source);
            return JSON.stringify({ instructions: [{ op: 'LD', var: 'IN0' }] });
        });
        let graph = handler.addRung(createLdGraph());
        const rungId = graph.rungs[0].id;
        graph = handler.addContact(graph, { position: { x: 40, y: 40 }, type: ContactType.NO, rungId });
        graph = handler.addCoil(graph, { position: { x: COIL_X_OFFSET, y: 40 }, type: CoilType.Normal, rungId });
        return { handler, graph, calls };
    }

    it('returns the HalProgram JSON on success (via injected bridge)', () => {
        // Arrange
        const { handler, graph, calls } = completeGraph();

        // Act
        const result = handler.compile(graph);

        // Assert
        expect(result.success).toBe(true);
        expect(result.diagnostics).toEqual([]);
        expect(JSON.parse(result.programJson).instructions).toHaveLength(1);
        expect(calls).toHaveLength(1);
        expect(calls[0]).toContain('NO IN0');
        expect(calls[0]).toContain('OUT OUT0');
    });

    it('returns diagnostics when the compiler reports errors', () => {
        // Arrange
        const handler = new LdOperationHandler(() =>
            JSON.stringify([{ severity: 'error', message: 'unknown variable', line: 2 }]),
        );
        let graph = handler.addRung(createLdGraph());
        const rungId = graph.rungs[0].id;
        graph = handler.addContact(graph, { position: { x: 40, y: 40 }, type: ContactType.NO, rungId });
        graph = handler.addCoil(graph, { position: { x: COIL_X_OFFSET, y: 40 }, type: CoilType.Normal, rungId });

        // Act
        const result = handler.compile(graph);

        // Assert
        expect(result.success).toBe(false);
        expect(result.programJson).toBe('');
        expect(result.diagnostics).toHaveLength(1);
        expect(result.diagnostics[0].message).toBe('unknown variable');
        expect(result.diagnostics[0].line).toBe(2);
    });

    it('short-circuits on validation failure without calling the bridge', () => {
        // Arrange
        let called = false;
        const handler = new LdOperationHandler(() => {
            called = true;
            return JSON.stringify({ instructions: [] });
        });
        const graph = handler.addRung(createLdGraph());
        // Orphan node (not referenced by any rung) is a hard error.
        graph.nodes.push(createContact(ContactType.NO, 'X99'));

        // Act
        const result = handler.compile(graph);

        // Assert
        expect(result.success).toBe(false);
        expect(called).toBe(false);
        expect(result.diagnostics.length).toBeGreaterThan(0);
        expect(result.diagnostics[0].code).toMatch(/^V/);
    });
});
