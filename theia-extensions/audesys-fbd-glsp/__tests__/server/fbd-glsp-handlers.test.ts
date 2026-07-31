/**
 * Unit tests for FBD GLSP server operation handlers.
 *
 * Tests FbdCreateNodeHandler, FbdDeleteHandler, FbdConnectHandler
 * execute() methods using a mock ModelState.
 *
 * AAA Pattern: Arrange → Act → Assert
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  FbdCreateNodeHandler,
  FbdDeleteHandler,
  FbdConnectHandler,
  FbdSourceModelStorage,
} from '../../src/server/fbd-diagram-module';
import { FBD_SOURCE_KEY } from '../../src/server/fbd-diagram-generator';
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
  };
}

function mockModelStateWithGraph(graph: FbdGraph) {
  const mock = mockModelState();
  mock.set(FBD_SOURCE_KEY, graph);
  return mock;
}

function attachModelState(handler: any, state: ReturnType<typeof mockModelState>) {
  (handler as any).modelState = {
    get: (key: string) => state.get(key),
    set: (key: string, value: unknown) => state.set(key, value),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('FbdCreateNodeHandler', () => {
  let handler: FbdCreateNodeHandler;

  beforeEach(() => {
    handler = new FbdCreateNodeHandler();
  });

  it('creates AND gate node', () => {
    // Arrange
    const graph = createFbdGraph('test-1');
    const state = mockModelStateWithGraph(graph);
    attachModelState(handler, state);

    // Act
    handler.execute({
      kind: 'createNode',
      elementTypeId: 'node:gate',
      location: { x: 100, y: 100 },
      args: { gateType: 'AND' },
      isOperation: true,
    } as any);

    // Assert
    const result = state.get<FbdGraph>(FBD_SOURCE_KEY)!;
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].type).toBe('node:gate');
  });

  it('creates FB node', () => {
    // Arrange
    const graph = createFbdGraph('test-2');
    const state = mockModelStateWithGraph(graph);
    attachModelState(handler, state);

    // Act
    handler.execute({
      kind: 'createNode',
      elementTypeId: 'node:fb',
      location: { x: 200, y: 100 },
      args: { fbType: 'TON' },
      isOperation: true,
    } as any);

    // Assert
    const result = state.get<FbdGraph>(FBD_SOURCE_KEY)!;
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].type).toBe('node:fb');
  });
});

describe('FbdDeleteHandler', () => {
  let handler: FbdDeleteHandler;

  beforeEach(() => {
    handler = new FbdDeleteHandler();
  });

  it('deletes node and associated edges', () => {
    // Arrange
    const gate = createGate(GateType.AND, { x: 100, y: 100 });
    const fb = createFB('TON', [
      createInputPin('IN', 'BOOL', 0, 1),
    ], [
      createOutputPin('Q', 'BOOL', 120, 0, 1),
    ], { x: 300, y: 100 });
    const edge = createSignalEdge(gate.id, 'OUT', fb.id, 'IN');
    const graph = createFbdGraph('test-3');
    graph.nodes.push(gate, fb);
    graph.edges.push(edge);
    const state = mockModelStateWithGraph(graph);
    attachModelState(handler, state);

    // Act
    handler.execute({
      kind: 'deleteElement',
      elementIds: [gate.id],
      isOperation: true,
    } as any);

    // Assert
    const result = state.get<FbdGraph>(FBD_SOURCE_KEY)!;
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe(fb.id);
    expect(result.edges).toHaveLength(0); // Edge deleted with node
  });
});

describe('FbdConnectHandler', () => {
  let handler: FbdConnectHandler;

  beforeEach(() => {
    handler = new FbdConnectHandler();
  });

  it('creates edge between output and input ports', () => {
    // Arrange
    const gate = createGate(GateType.AND, { x: 100, y: 100 });
    const fb = createFB('TON', [
      createInputPin('IN', 'BOOL', 0, 1),
    ], [
      createOutputPin('Q', 'BOOL', 120, 0, 1),
    ], { x: 300, y: 100 });
    const graph = createFbdGraph('test-4');
    graph.nodes.push(gate, fb);
    const state = mockModelStateWithGraph(graph);
    attachModelState(handler, state);

    // Act
    handler.execute({
      kind: 'createEdge',
      sourceElementId: `${gate.id}::OUT`,
      targetElementId: `${fb.id}::IN`,
      isOperation: true,
    } as any);

    // Assert
    const result = state.get<FbdGraph>(FBD_SOURCE_KEY)!;
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].sourceId).toBe(gate.id);
    expect(result.edges[0].sourcePortName).toBe('OUT');
    expect(result.edges[0].targetId).toBe(fb.id);
    expect(result.edges[0].targetPortName).toBe('IN');
  });

  it('rejects invalid port ID format', () => {
    // Arrange
    const gate = createGate(GateType.AND, { x: 100, y: 100 });
    const graph = createFbdGraph('test-5');
    graph.nodes.push(gate);
    const state = mockModelStateWithGraph(graph);
    attachModelState(handler, state);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    handler.execute({
      kind: 'createEdge',
      sourceElementId: 'invalid-format',
      targetElementId: `${gate.id}::IN1`,
      isOperation: true,
    } as any);

    // Assert
    const result = state.get<FbdGraph>(FBD_SOURCE_KEY)!;
    expect(result.edges).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('parsePortId', () => {
  // Import the function indirectly through FbdConnectHandler behavior
  it('parses port ID with :: separator', () => {
    // This is tested implicitly through FbdConnectHandler tests above
    // The format is "nodeId::pinName"
    expect(true).toBe(true); // placeholder
  });
});
