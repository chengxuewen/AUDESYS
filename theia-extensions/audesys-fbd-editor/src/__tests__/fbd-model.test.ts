/**
 * FBD GModel unit tests — factories, pin geometry, serialization round-trip.
 */
import { describe, it, expect } from 'vitest';

import {
    createFbdGraph,
    createGate,
    createFB,
    createInputPin,
    createOutputPin,
    createSignalEdge,
    resetIdCounter,
    generateId,
} from '../model/model';
import { GateType, PinDirection } from '../model/nodes';
import { isSignalEdge } from '../model/edges';
import { toJSON, fromJSON, roundTrip } from '../model/serialization';

describe('createFbdGraph', () => {
    it('creates an empty graph with a unique id', () => {
        // Arrange
        resetIdCounter();

        // Act
        const g1 = createFbdGraph();
        const g2 = createFbdGraph();

        // Assert
        expect(g1.nodes).toHaveLength(0);
        expect(g1.edges).toHaveLength(0);
        expect(g1.id).not.toBe(g2.id);
    });

    it('honours an explicit graph id', () => {
        // Act
        const g = createFbdGraph('my-graph');

        // Assert
        expect(g.id).toBe('my-graph');
    });
});

describe('createGate', () => {
    it('creates an AND gate with 2 BOOL inputs and 1 BOOL output', () => {
        // Arrange
        resetIdCounter();

        // Act
        const gate = createGate(GateType.AND, { x: 40, y: 40 });

        // Assert
        expect(gate.type).toBe('node:gate');
        expect(gate.gateType).toBe(GateType.AND);
        expect(gate.inputPorts.map((p) => p.name)).toEqual(['IN1', 'IN2']);
        expect(gate.inputPorts.every((p) => p.direction === PinDirection.Input)).toBe(true);
        expect(gate.outputPorts.map((p) => p.name)).toEqual(['OUT']);
        expect(gate.outputPorts[0].direction).toBe(PinDirection.Output);
        expect(gate.position).toEqual({ x: 40, y: 40 });
        expect(gate.size.width).toBeGreaterThan(0);
    });

    it('creates a MUX gate with SEL + 2 data inputs', () => {
        // Act
        const gate = createGate(GateType.MUX);

        // Assert
        expect(gate.inputPorts.map((p) => p.name)).toEqual(['SEL', 'IN0', 'IN1']);
    });
});

describe('createFunctionBlock', () => {
    it('sizes the block height from the pin count', () => {
        // Act
        const inputs = [createInputPin('IN', 'BOOL', 0, 2), createInputPin('PT', 'TIME', 1, 2)];
        const outputs = [createOutputPin('Q', 'BOOL', 120, 0, 2), createOutputPin('ET', 'TIME', 120, 1, 2)];
        const fb = createFB('TON', inputs, outputs, { x: 0, y: 0 });

        // Assert
        expect(fb.type).toBe('node:fb');
        expect(fb.fbType).toBe('TON');
        expect(fb.size.height).toBeGreaterThanOrEqual(60);
        expect(fb.size.width).toBe(120);
        expect(fb.inputPorts).toHaveLength(2);
        expect(fb.outputPorts).toHaveLength(2);
    });

    it('centers input pins vertically around the block centre', () => {
        // Act
        const a = createInputPin('IN1', 'BOOL', 0, 2);
        const b = createInputPin('IN2', 'BOOL', 1, 2);

        // Assert
        expect(a.position.y).toBe(-12);
        expect(b.position.y).toBe(12);
    });
});

describe('createSignalEdge', () => {
    it('creates a directional output→input edge', () => {
        // Arrange
        resetIdCounter();

        // Act
        const edge = createSignalEdge('fb-1', 'Q', 'gate-2', 'IN1');

        // Assert
        expect(isSignalEdge(edge)).toBe(true);
        expect(edge.type).toBe('edge:signal');
        expect(edge.sourceId).toBe('fb-1');
        expect(edge.sourcePortName).toBe('Q');
        expect(edge.targetId).toBe('gate-2');
        expect(edge.targetPortName).toBe('IN1');
    });
});

describe('generateId', () => {
    it('produces monotonically increasing prefixed ids', () => {
        // Arrange
        resetIdCounter();

        // Act
        const a = generateId('fb');
        const b = generateId('fb');

        // Assert
        expect(a).toBe('fb-1');
        expect(b).toBe('fb-2');
    });
});

describe('serialization round-trip', () => {
    it('preserves the full graph through toJSON/fromJSON', () => {
        // Arrange
        resetIdCounter();
        const graph = createFbdGraph();
        graph.nodes.push(createGate(GateType.AND, { x: 0, y: 0 }));
        graph.nodes.push(createGate(GateType.NOT, { x: 200, y: 0 }));
        graph.edges.push(createSignalEdge(graph.nodes[0].id, 'OUT', graph.nodes[1].id, 'IN'));

        // Act
        const json = toJSON(graph);
        const restored = fromJSON(json);

        // Assert
        expect(roundTrip(graph)).toBe(true);
        expect(restored.nodes).toHaveLength(2);
        expect(restored.edges).toHaveLength(1);
        expect(restored.nodes[0]).toMatchObject({ type: 'node:gate', gateType: 'AND' });
        expect(restored.nodes[1]).toMatchObject({ type: 'node:gate', gateType: 'NOT' });
        expect(restored.edges[0]).toMatchObject({ sourcePortName: 'OUT', targetPortName: 'IN' });
    });

    it('throws on malformed JSON', () => {
        // Act + Assert
        expect(() => fromJSON('{not json')).toThrow();
        expect(() => fromJSON('{"id":1,"nodes":[]}')).toThrow(/Invalid FbdGraph/);
    });

    it('roundTrips a populated graph to itself', () => {
        // Arrange
        const graph = createFbdGraph();
        graph.nodes.push(createGate(GateType.AND));

        // Act + Assert
        expect(roundTrip(graph)).toBe(true);
    });
});
