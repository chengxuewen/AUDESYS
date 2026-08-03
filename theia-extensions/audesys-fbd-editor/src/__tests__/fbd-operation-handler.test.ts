/**
 * FbdOperationHandler unit tests — CRUD, pin wiring, validation, compile (mocked bridge).
 * The compile function is injected, so no napi-rs/theia-bridge module is loaded.
 */
import { describe, it, expect } from 'vitest';

import { FbdOperationHandler } from '../backend/fbd-operation-handler';
import { createFbdGraph, resetIdCounter, FbdGraph } from '../model/model';
import { GateType, isGateNode, isFunctionBlockNode } from '../model/nodes';

/** Fresh handler + empty graph, deterministic ids. */
function fresh(): { handler: FbdOperationHandler; graph: FbdGraph } {
    resetIdCounter();
    return { handler: new FbdOperationHandler(() => JSON.stringify({ instructions: [] })), graph: createFbdGraph() };
}

describe('createGate', () => {
    it('adds an AND gate with 2 input pins, 1 output pin, snapped to the 20px grid', () => {
        // Arrange
        const { handler, graph } = fresh();

        // Act — 47/33 must snap to 40/40
        const next = handler.createGate(graph, { gateType: GateType.AND, position: { x: 47, y: 33 } });

        // Assert
        const gate = next.nodes[0];
        expect(gate).toBeDefined();
        expect(isGateNode(gate!)).toBe(true);
        expect(gate?.position).toEqual({ x: 40, y: 40 });
        expect((gate as { inputPorts: Array<{ name: string }> }).inputPorts.map((p) => p.name)).toEqual(['IN1', 'IN2']);
        expect((gate as { outputPorts: Array<{ name: string }> }).outputPorts.map((p) => p.name)).toEqual(['OUT']);
    });

    it('creates a NOT gate with a single input pin', () => {
        // Arrange
        const { handler, graph } = fresh();

        // Act
        const next = handler.createGate(graph, { gateType: GateType.NOT, position: { x: 0, y: 0 } });

        // Assert
        const gate = next.nodes[0];
        expect((gate as { inputPorts: Array<{ name: string }> }).inputPorts.map((p) => p.name)).toEqual(['IN']);
    });
});

describe('createFunctionBlock', () => {
    it('creates a TON block with type-specific pins (IN/PT in, Q/ET out)', () => {
        // Arrange
        const { handler, graph } = fresh();

        // Act
        const next = handler.createFunctionBlock(graph, { fbType: 'TON', position: { x: 10, y: 10 } });

        // Assert
        const fb = next.nodes[0];
        expect(isFunctionBlockNode(fb!)).toBe(true);
        expect((fb as { fbType: string }).fbType).toBe('TON');
        expect((fb as { inputPorts: Array<{ name: string }> }).inputPorts.map((p) => p.name)).toEqual(['IN', 'PT']);
        expect((fb as { outputPorts: Array<{ name: string }> }).outputPorts.map((p) => p.name)).toEqual(['Q', 'ET']);
        expect(fb?.position).toEqual({ x: 20, y: 20 }); // snapped
    });

    it('falls back to a generic 2-in/2-out block for unknown types', () => {
        // Arrange
        const { handler, graph } = fresh();

        // Act
        const next = handler.createFunctionBlock(graph, { fbType: 'MY_FANCY_FB', position: { x: 0, y: 0 } });

        // Assert
        const fb = next.nodes[0];
        expect((fb as { inputPorts: Array<{ name: string }> }).inputPorts.map((p) => p.name)).toEqual(['IN1', 'IN2']);
        expect((fb as { outputPorts: Array<{ name: string }> }).outputPorts.map((p) => p.name)).toEqual(['Q1', 'Q2']);
    });
});

describe('connectPins', () => {
    it('connects an output pin to an input pin', () => {
        // Arrange
        const { handler, graph } = fresh();
        const withGates = handler.createGate(graph, { gateType: GateType.AND, position: { x: 0, y: 0 } });
        const srcId = withGates.nodes[0].id;
        const withBoth = handler.createGate(withGates, { gateType: GateType.NOT, position: { x: 200, y: 0 } });
        const tgtId = withBoth.nodes[1].id;

        // Act
        const next = handler.connectPins(withBoth, {
            sourceNodeId: srcId, sourcePortName: 'OUT',
            targetNodeId: tgtId, targetPortName: 'IN',
        });

        // Assert
        expect(next.edges).toHaveLength(1);
        expect(next.edges[0]).toMatchObject({ sourceId: srcId, sourcePortName: 'OUT', targetId: tgtId, targetPortName: 'IN' });
    });

    it('is idempotent for duplicate connections', () => {
        // Arrange
        const { handler, graph } = fresh();
        const withGates = handler.createGate(graph, { gateType: GateType.AND, position: { x: 0, y: 0 } });
        const srcId = withGates.nodes[0].id;
        const withBoth = handler.createGate(withGates, { gateType: GateType.NOT, position: { x: 200, y: 0 } });
        const tgtId = withBoth.nodes[1].id;
        const params = {
            sourceNodeId: srcId, sourcePortName: 'OUT',
            targetNodeId: tgtId, targetPortName: 'IN',
        };

        // Act
        const once = handler.connectPins(withBoth, params);
        const twice = handler.connectPins(once, params);

        // Assert
        expect(twice.edges).toHaveLength(1);
    });

    it('rejects input→input connections (direction validation)', () => {
        // Arrange
        const { handler, graph } = fresh();
        const withGates = handler.createGate(graph, { gateType: GateType.AND, position: { x: 0, y: 0 } });
        const srcId = withGates.nodes[0].id;
        const withBoth = handler.createGate(withGates, { gateType: GateType.NOT, position: { x: 200, y: 0 } });
        const tgtId = withBoth.nodes[1].id;

        // Act + Assert
        expect(() => handler.connectPins(withBoth, {
            sourceNodeId: srcId, sourcePortName: 'IN1',
            targetNodeId: tgtId, targetPortName: 'IN',
        })).toThrow(/must be Output/);
    });

    it('rejects incompatible data types (BOOL → INT)', () => {
        // Arrange
        const { handler, graph } = fresh();
        const withGate = handler.createGate(graph, { gateType: GateType.AND, position: { x: 0, y: 0 } });
        const srcId = withGate.nodes[0].id;
        const withFb = handler.createFunctionBlock(withGate, { fbType: 'ADD', position: { x: 200, y: 0 } });
        const tgtId = withFb.nodes[1].id;

        // Act + Assert — ADD.IN1 is INT, AND.OUT is BOOL
        expect(() => handler.connectPins(withFb, {
            sourceNodeId: srcId, sourcePortName: 'OUT',
            targetNodeId: tgtId, targetPortName: 'IN1',
        })).toThrow(/Type mismatch/);
    });
});

describe('deleteElement', () => {
    it('removes the node and cascades removal of connected edges', () => {
        // Arrange
        const { handler, graph } = fresh();
        const withGates = handler.createGate(graph, { gateType: GateType.AND, position: { x: 0, y: 0 } });
        const srcId = withGates.nodes[0].id;
        const withBoth = handler.createGate(withGates, { gateType: GateType.NOT, position: { x: 200, y: 0 } });
        const tgtId = withBoth.nodes[1].id;
        const wired = handler.connectPins(withBoth, {
            sourceNodeId: srcId, sourcePortName: 'OUT',
            targetNodeId: tgtId, targetPortName: 'IN',
        });

        // Act
        const next = handler.deleteElement(wired, { elementId: srcId });

        // Assert
        expect(next.nodes).toHaveLength(1);
        expect(next.edges).toHaveLength(0);
    });

    it('throws for an unknown element id', () => {
        // Arrange
        const { handler, graph } = fresh();

        // Act + Assert
        expect(() => handler.deleteElement(graph, { elementId: 'nope' })).toThrow(/not found/);
    });
});

describe('moveElement', () => {
    it('snaps the new position to the 20px grid', () => {
        // Arrange
        const { handler, graph } = fresh();
        const withGate = handler.createGate(graph, { gateType: GateType.AND, position: { x: 0, y: 0 } });
        const id = withGate.nodes[0].id;

        // Act
        const next = handler.moveElement(withGate, { elementId: id, newPosition: { x: 37, y: 52 } });

        // Assert
        expect(next.nodes[0].position).toEqual({ x: 40, y: 60 });
    });
});

describe('changeGateType', () => {
    it('regenerates pins while preserving the element id', () => {
        // Arrange
        const { handler, graph } = fresh();
        const withGate = handler.createGate(graph, { gateType: GateType.AND, position: { x: 0, y: 0 } });
        const id = withGate.nodes[0].id;

        // Act
        const next = handler.changeGateType(withGate, { elementId: id, newGateType: GateType.NOT });

        // Assert
        expect(next.nodes[0].id).toBe(id);
        expect((next.nodes[0] as { inputPorts: Array<{ name: string }> }).inputPorts.map((p) => p.name)).toEqual(['IN']);
    });
});

describe('validate + compile', () => {
    it('warns about unconnected output pins but stays valid', () => {
        // Arrange
        const { handler, graph } = fresh();
        const withGate = handler.createGate(graph, { gateType: GateType.AND, position: { x: 0, y: 0 } });

        // Act
        const result = handler.validate(withGate);

        // Assert
        expect(result.valid).toBe(true);
        expect(result.findings.some((f) => f.message.includes('Unconnected output'))).toBe(true);
    });

    it('compile succeeds on a valid graph with the injected bridge', () => {
        // Arrange
        const { handler, graph } = fresh();
        const withGate = handler.createGate(graph, { gateType: GateType.AND, position: { x: 0, y: 0 } });

        // Act
        const result = handler.compile(withGate);

        // Assert
        expect(result.success).toBe(true);
        expect(result.programJson).toContain('instructions');
    });

    it('compile reports validation errors and never calls the bridge', () => {
        // Arrange
        let bridgeCalls = 0;
        resetIdCounter();
        const handler = new FbdOperationHandler(() => {
            bridgeCalls += 1;
            return JSON.stringify({ instructions: [] });
        });
        const graph = createFbdGraph();
        const withGate = handler.createGate(graph, { gateType: GateType.AND, position: { x: 0, y: 0 } });
        const id = withGate.nodes[0].id;
        // Manually inject a dangling edge → structural error
        const broken: FbdGraph = JSON.parse(JSON.stringify(withGate));
        broken.edges.push({ id: 'edge-x', type: 'edge:signal', sourceId: id, sourcePortName: 'OUT', targetId: 'ghost', targetPortName: 'IN' });

        // Act
        const result = handler.compile(broken);

        // Assert
        expect(result.success).toBe(false);
        expect(bridgeCalls).toBe(0);
    });
});
