/**
 * Unit tests for FBD DiagramGenerator (GModelFactory).
 *
 * Tests FbdGraph → GGraph conversion with GPort support.
 *
 * AAA Pattern: Arrange → Act → Assert
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FbdDiagramGenerator, FBD_SOURCE_KEY } from '../../src/server/fbd-diagram-generator';
import {
  FbdGraph,
  createFbdGraph,
  createGate,
  createFB,
  createSignalEdge,
  createInputPin,
  createOutputPin,
} from '../../src/gmodel/model';
import { GateType } from '../../src/gmodel/nodes';

// ============================================================================
// Helpers
// ============================================================================

/** Minimal ModelState mock. */
function mockModelState() {
  const store = new Map<string, unknown>();
  return {
    store,
    get<T>(key: string): T | undefined { return store.get(key) as T | undefined; },
    set<T>(key: string, value: T): void { store.set(key, value); },
    updateRoot(root: unknown): void { store.set('root', root); },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('FbdDiagramGenerator', () => {
  let generator: FbdDiagramGenerator;
  let modelState: ReturnType<typeof mockModelState>;

  beforeEach(() => {
    generator = new FbdDiagramGenerator();
    modelState = mockModelState();
    (generator as any).modelState = modelState;
  });

  describe('createModel()', () => {
    it('creates empty graph when no source model', () => {
      // Arrange — no source model set

      // Act
      generator.createModel();

      // Assert
      const root = modelState.store.get('root') as any;
      expect(root).toBeDefined();
      expect(root.type).toBe('graph');
      expect(root.id).toBe('fbd-root');
    });

    it('converts FbdGraph with gates to GGraph', () => {
      // Arrange
      const andGate = createGate(GateType.AND, { x: 100, y: 100 });
      const graph = createFbdGraph('test-1');
      graph.nodes.push(andGate);
      modelState.set(FBD_SOURCE_KEY, graph);

      // Act
      generator.createModel();

      // Assert
      const root = modelState.store.get('root') as any;
      expect(root.children).toHaveLength(1);
      const gNode = root.children[0];
      expect(gNode.type).toBe('node:gate');
      expect(gNode.id).toBe(andGate.id);
    });

    it('creates GPort children for gate pins', () => {
      // Arrange
      const andGate = createGate(GateType.AND, { x: 100, y: 100 });
      const graph = createFbdGraph('test-2');
      graph.nodes.push(andGate);
      modelState.set(FBD_SOURCE_KEY, graph);

      // Act
      generator.createModel();

      // Assert
      const root = modelState.store.get('root') as any;
      const gNode = root.children[0];
      // AND gate has 2 input + 1 output + 1 label = 4 children
      const ports = gNode.children.filter((c: any) => c.type === 'port');
      expect(ports).toHaveLength(3); // IN1, IN2, OUT
    });

    it('uses :: separator for port IDs', () => {
      // Arrange
      const andGate = createGate(GateType.AND, { x: 100, y: 100 });
      const graph = createFbdGraph('test-3');
      graph.nodes.push(andGate);
      modelState.set(FBD_SOURCE_KEY, graph);

      // Act
      generator.createModel();

      // Assert
      const root = modelState.store.get('root') as any;
      const gNode = root.children[0];
      const ports = gNode.children.filter((c: any) => c.type === 'port');
      expect(ports[0].id).toMatch(/::/);  // e.g., "gate-1::IN1"
    });

    it('creates GEdge with port-to-port source/target', () => {
      // Arrange
      const andGate = createGate(GateType.AND, { x: 100, y: 100 });
      const tonFb = createFB('TON', [
        createInputPin('IN', 'BOOL', 0, 1),
      ], [
        createOutputPin('Q', 'BOOL', 120, 0, 1),
      ], { x: 300, y: 100 });
      const edge = createSignalEdge(andGate.id, 'OUT', tonFb.id, 'IN');
      const graph = createFbdGraph('test-4');
      graph.nodes.push(andGate, tonFb);
      graph.edges.push(edge);
      modelState.set(FBD_SOURCE_KEY, graph);

      // Act
      generator.createModel();

      // Assert
      const root = modelState.store.get('root') as any;
      const gEdge = root.children.find((c: any) => c.type === 'edge:signal');
      expect(gEdge).toBeDefined();
      expect(gEdge.sourceId).toBe(`${andGate.id}::OUT`);
      expect(gEdge.targetId).toBe(`${tonFb.id}::IN`);
    });
  });
});
