/**
 * LdGraph model + factory + serialization round-trip tests.
 * SDD: LD-GMODEL (D110 — LdGraph is the single source of truth).
 */
import { describe, it, expect } from 'vitest';

import {
    createLdGraph,
    createContact,
    createCoil,
    createRung,
    createWire,
    createPowerRail,
    generateId,
} from '../model/model';
import { ContactType, CoilType, PowerRailSide } from '../model/nodes';
import { toJSON, fromJSON, roundTrip, validateGraph } from '../model/serialization';

describe('createLdGraph', () => {
    it('returns a valid empty graph', () => {
        // Arrange / Act
        const graph = createLdGraph();

        // Assert
        expect(graph.id).toBeTruthy();
        expect(graph.nodes).toEqual([]);
        expect(graph.edges).toEqual([]);
        expect(graph.rungs).toEqual([]);
    });

    it('uses the provided id when given', () => {
        // Arrange / Act
        const graph = createLdGraph('my-diagram');

        // Assert
        expect(graph.id).toBe('my-diagram');
    });
});

describe('node factories', () => {
    it('createContact creates a node:contact with defaults', () => {
        // Arrange / Act
        const contact = createContact(ContactType.NO, 'X1', { x: 40, y: 40 });

        // Assert
        expect(contact.type).toBe('node:contact');
        expect(contact.contactType).toBe(ContactType.NO);
        expect(contact.variableName).toBe('X1');
        expect(contact.position).toEqual({ x: 40, y: 40 });
        expect(contact.size).toEqual({ width: 36, height: 36 });
    });

    it('createCoil creates a node:coil with defaults', () => {
        // Arrange / Act
        const coil = createCoil(CoilType.Set, 'Y1');

        // Assert
        expect(coil.type).toBe('node:coil');
        expect(coil.coilType).toBe(CoilType.Set);
        expect(coil.variableName).toBe('Y1');
        expect(coil.position).toEqual({ x: 0, y: 0 });
    });

    it('createPowerRail creates left/right rails', () => {
        // Arrange / Act
        const left = createPowerRail(PowerRailSide.Left);
        const right = createPowerRail(PowerRailSide.Right, { x: 640, y: 0 }, 200);

        // Assert
        expect(left.type).toBe('node:powerrail');
        expect(left.side).toBe(PowerRailSide.Left);
        expect(right.side).toBe(PowerRailSide.Right);
        expect(right.size.height).toBe(200);
    });

    it('createRung creates a rung with element list', () => {
        // Arrange / Act
        const rung = createRung(1, ['a', 'b'], 'Main');

        // Assert
        expect(rung.rungNumber).toBe(1);
        expect(rung.elementIds).toEqual(['a', 'b']);
        expect(rung.comment).toBe('Main');
        expect(rung.id).toMatch(/^rung-/);
    });
});

describe('edge factories', () => {
    it('createWire creates an edge:wire between two nodes', () => {
        // Arrange / Act
        const wire = createWire('contact-1', 'coil-1');

        // Assert
        expect(wire.type).toBe('edge:wire');
        expect(wire.sourceId).toBe('contact-1');
        expect(wire.targetId).toBe('coil-1');
        expect(wire.routingPoints).toBeUndefined();
    });
});

describe('generateId', () => {
    it('produces unique IDs across calls and prefixes', () => {
        // Arrange
        const seen = new Set<string>();

        // Act
        for (let i = 0; i < 500; i++) {
            seen.add(generateId('contact'));
            seen.add(generateId('coil'));
        }

        // Assert
        expect(seen.size).toBe(1000);
    });
});

describe('toJSON / fromJSON round-trip', () => {
    it('preserves graph structure', () => {
        // Arrange
        const graph = createLdGraph('rt-graph');
        const contact = createContact(ContactType.NC, 'X2', { x: 80, y: 40 });
        const coil = createCoil(CoilType.Normal, 'Y2', { x: 600, y: 40 });
        const rung = createRung(1, [contact.id, coil.id]);
        graph.nodes.push(contact, coil);
        graph.edges.push(createWire(contact.id, coil.id));
        graph.rungs.push(rung);

        // Act
        const restored = fromJSON(toJSON(graph));

        // Assert
        expect(restored).toEqual(graph);
        expect(roundTrip(graph)).toBe(true);
    });

    it('fromJSON rejects malformed input', () => {
        // Arrange / Act / Assert
        expect(() => fromJSON('not json')).toThrow();
        expect(() => fromJSON('{"id":"x"}')).toThrow(/Invalid LdGraph/);
    });
});

describe('validateGraph', () => {
    it('flags dangling edge references', () => {
        // Arrange
        const graph = createLdGraph();
        const contact = createContact(ContactType.NO, 'X1');
        graph.nodes.push(contact);
        graph.rungs.push(createRung(1, [contact.id]));
        graph.edges.push(createWire(contact.id, 'missing-node'));

        // Act
        const result = validateGraph(graph);

        // Assert
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('missing-node'))).toBe(true);
    });
});
