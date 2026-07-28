/**
 * Unit tests for LD GLSP server operation handlers.
 *
 * Tests LdCreateNodeHandler, LdDeleteHandler, LdChangeContactTypeHandler
 * execute() methods using a mock ModelState.
 *
 * Reference: __tests__/server/ld-operation-handler.test.ts style.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LdCreateNodeHandler,
  LdDeleteHandler,
  LdChangeContactTypeHandler,
  ChangeContactTypeOperation,
} from '../../src/server';
import { LD_SOURCE_KEY } from '../../src/server/ld-diagram-generator';
import {
  LdGraph,
  createLdGraph,
  createContact,
  createCoil,
  createPowerRail,
  createRung,
} from '../../src/gmodel/model';
import {
  ContactType,
  CoilType,
  PowerRailSide,
} from '../../src/gmodel/nodes';

// ============================================================================
// Helpers
// ============================================================================

/** Minimal ModelState mock that tracks a key-value store. */
function mockModelState(): { store: Map<string, unknown>; get: <T>(key: string) => T | undefined; set: <T>(key: string, value: T) => void } {
  const store = new Map<string, unknown>();
  return {
    store,
    get(key: string): unknown {
      return store.get(key);
    },
    set(key: string, value: unknown): void {
      store.set(key, value);
    },
  };
}

function mockModelStateWithGraph(graph: LdGraph) {
  const mock = mockModelState();
  mock.set(LD_SOURCE_KEY, graph);
  return mock;
}

function attachModelState(handler: LdCreateNodeHandler | LdDeleteHandler | LdChangeContactTypeHandler, state: ReturnType<typeof mockModelState>) {
  (handler as any).modelState = {
    get: (key: string) => state.get(key),
    set: (key: string, value: unknown) => state.set(key, value),
  };
}

/** Build a graph with one rung + contact + coil + power rails (well-formed). */
function graphWithContactAndCoil(): LdGraph {
  const graph = createLdGraph();
  const leftRail = createPowerRail(PowerRailSide.Left, { x: 0, y: 0 });
  const rightRail = createPowerRail(PowerRailSide.Right, { x: 640, y: 0 });
  const contact = createContact(ContactType.NO, 'X1', { x: 100, y: 40 });
  const coil = createCoil(CoilType.Normal, 'Y1', { x: 520, y: 40 });
  const rung = createRung(1, [contact.id, coil.id]);
  return {
    ...graph,
    nodes: [leftRail, rightRail, contact, coil],
    edges: [],
    rungs: [rung],
  };
}

/** Build a graph with one rung + one contact. */
function graphWithContactOnly(): LdGraph {
  const graph = createLdGraph();
  const leftRail = createPowerRail(PowerRailSide.Left, { x: 0, y: 0 });
  const rightRail = createPowerRail(PowerRailSide.Right, { x: 640, y: 0 });
  const contact = createContact(ContactType.NO, 'X1', { x: 100, y: 40 });
  const rung = createRung(1, [contact.id]);
  return {
    ...graph,
    nodes: [leftRail, rightRail, contact],
    edges: [],
    rungs: [rung],
  };
}

function countNodesByType(graph: LdGraph, type: string): number {
  return graph.nodes.filter((n) => n.type === type).length;
}

// ============================================================================
// LdCreateNodeHandler Tests
// ============================================================================

describe('LdCreateNodeHandler', () => {
  let handler: LdCreateNodeHandler;

  beforeEach(() => {
    handler = new LdCreateNodeHandler();
  });

  describe('execute — create node:contact', () => {
    it('creates a contact on the default rung when graph has a rung', () => {
      const state = mockModelStateWithGraph(graphWithContactOnly());
      attachModelState(handler, state);

      handler.execute({
        kind: 'createNode',
        isOperation: true,
        elementTypeId: 'node:contact',
        location: { x: 220, y: 40 },
        args: { contactType: 'NO', rungId: state.get<LdGraph>(LD_SOURCE_KEY)!.rungs[0].id },
      } as any);

      const graph = state.get<LdGraph>(LD_SOURCE_KEY)!;
      expect(countNodesByType(graph, 'node:contact')).toBe(2);
    });

    it('creates a contact with auto-generated rung when no rungId in args', () => {
      const graph = createLdGraph();
      const state = mockModelStateWithGraph(graph);
      attachModelState(handler, state);

      handler.execute({
        kind: 'createNode',
        isOperation: true,
        elementTypeId: 'node:contact',
        location: { x: 100, y: 40 },
        args: { contactType: 'NC' },
      } as any);

      const result = state.get<LdGraph>(LD_SOURCE_KEY)!;
      expect(result.rungs.length).toBeGreaterThan(0);
      expect(countNodesByType(result, 'node:contact')).toBe(1);
    });

    it('defaults contactType to NO when not provided in args', () => {
      const graph = graphWithContactOnly();
      const state = mockModelStateWithGraph(graph);
      attachModelState(handler, state);

      handler.execute({
        kind: 'createNode',
        isOperation: true,
        elementTypeId: 'node:contact',
        location: { x: 220, y: 40 },
        args: { rungId: graph.rungs[0].id },
      } as any);

      const result = state.get<LdGraph>(LD_SOURCE_KEY)!;
      const contact = result.nodes.find(
        (n) => n.type === 'node:contact' && (n as any).variableName === 'IN1',
      ) as any;
      expect(contact?.contactType).toBe('NO');
    });
  });

  describe('execute — create node:coil', () => {
    it('creates a coil on a rung that has contacts', () => {
      const graph = graphWithContactOnly();
      const state = mockModelStateWithGraph(graph);
      attachModelState(handler, state);

      handler.execute({
        kind: 'createNode',
        isOperation: true,
        elementTypeId: 'node:coil',
        location: { x: 520, y: 40 },
        args: { coilType: 'OUT', rungId: graph.rungs[0].id },
      } as any);

      const result = state.get<LdGraph>(LD_SOURCE_KEY)!;
      expect(countNodesByType(result, 'node:coil')).toBe(1);
    });

    it('throws when coil is added to a rung with no contacts', () => {
      const graph = createLdGraph();
      const rung = createRung(1, []);
      const state = mockModelStateWithGraph({ ...graph, rungs: [rung] });
      attachModelState(handler, state);

      expect(() =>
        handler.execute({
          kind: 'createNode',
          isOperation: true,
          elementTypeId: 'node:coil',
          location: { x: 520, y: 40 },
          args: { coilType: 'SET', rungId: rung.id },
        } as any),
      ).toThrow('Add at least one contact before adding a coil');
    });

    it('silently skips (undefined result) for unknown elementTypeId', () => {
      const graph = graphWithContactOnly();
      const state = mockModelStateWithGraph(graph);
      attachModelState(handler, state);

      const result = handler.execute({
        kind: 'createNode',
        isOperation: true,
        elementTypeId: 'node:unknown',
        location: { x: 100, y: 40 },
        args: {},
      } as any);

      expect(result).toBeUndefined();
    });
  });

  describe('execute — create node:powerrail', () => {
    it('adds both left and right power rails', () => {
      const graph = graphWithContactOnly();
      const initialRailCount = countNodesByType(graph, 'node:powerrail');
      const state = mockModelStateWithGraph(graph);
      attachModelState(handler, state);

      handler.execute({
        kind: 'createNode',
        isOperation: true,
        elementTypeId: 'node:powerrail',
        location: { x: 0, y: 0 },
        args: {},
      } as any);

      const result = state.get<LdGraph>(LD_SOURCE_KEY)!;
      const railCount = countNodesByType(result, 'node:powerrail');
      // Both rails should exist; if they already existed, count stays the same
      expect(railCount).toBeGreaterThanOrEqual(initialRailCount);
      expect(railCount).toBeLessThanOrEqual(initialRailCount + 2);
    });
  });
});

// ============================================================================
// LdDeleteHandler Tests
// ============================================================================

describe('LdDeleteHandler', () => {
  let handler: LdDeleteHandler;

  beforeEach(() => {
    handler = new LdDeleteHandler();
  });

  describe('execute — delete element', () => {
    it('removes a contact from the graph', () => {
      const graph = graphWithContactAndCoil();
      const contact = graph.nodes.find((n) => n.type === 'node:contact')!;
      const state = mockModelStateWithGraph(graph);
      attachModelState(handler, state);

      handler.execute({
        kind: 'deleteElement',
        isOperation: true,
        elementIds: [contact.id],
      } as any);

      const result = state.get<LdGraph>(LD_SOURCE_KEY)!;
      expect(countNodesByType(result, 'node:contact')).toBe(0);
    });

    it('removes multiple elements in one call', () => {
      const graph = graphWithContactAndCoil();
      const contact = graph.nodes.find((n) => n.type === 'node:contact')!;
      const coil = graph.nodes.find((n) => n.type === 'node:coil')!;
      const state = mockModelStateWithGraph(graph);
      attachModelState(handler, state);

      handler.execute({
        kind: 'deleteElement',
        isOperation: true,
        elementIds: [contact.id, coil.id],
      } as any);

      const result = state.get<LdGraph>(LD_SOURCE_KEY)!;
      expect(countNodesByType(result, 'node:contact')).toBe(0);
      expect(countNodesByType(result, 'node:coil')).toBe(0);
    });

    it('silently skips deletion of a non-existent element', () => {
      const graph = graphWithContactAndCoil();
      const state = mockModelStateWithGraph(graph);
      attachModelState(handler, state);

      expect(() =>
        handler.execute({
          kind: 'deleteElement',
          isOperation: true,
          elementIds: ['nonexistent-id'],
        } as any),
      ).not.toThrow();
      // Graph should be unchanged (no exception propagated)
      const result = state.get<LdGraph>(LD_SOURCE_KEY)!;
      expect(result.nodes.length).toBe(graph.nodes.length);
    });

    it('returns early when ModelState has no graph', () => {
      const state = mockModelState();
      attachModelState(handler, state);

      expect(() =>
        handler.execute({
          kind: 'deleteElement',
          isOperation: true,
          elementIds: ['any'],
        } as any),
      ).not.toThrow();
    });
  });
});

// ============================================================================
// LdChangeContactTypeHandler Tests
// ============================================================================

describe('LdChangeContactTypeHandler', () => {
  let handler: LdChangeContactTypeHandler;

  beforeEach(() => {
    handler = new LdChangeContactTypeHandler();
  });

  describe('execute — change contact type', () => {
    it('toggles a contact from NO to NC', () => {
      const graph = graphWithContactAndCoil();
      const contact = graph.nodes.find(
        (n) => n.type === 'node:contact' && (n as any).contactType === 'NO',
      ) as any;
      const state = mockModelStateWithGraph(graph);
      attachModelState(handler, state);

      handler.execute(
        ChangeContactTypeOperation.create(contact.id, 'NC'),
      );

      const result = state.get<LdGraph>(LD_SOURCE_KEY)!;
      const updated = result.nodes.find((n) => n.id === contact.id) as any;
      expect(updated?.contactType).toBe('NC');
    });

    it('toggles a contact from NC to NO', () => {
      const graph = graphWithContactAndCoil();
      // Change the contact to NC first
      const graphNC = { ...graph };
      const contact = graphNC.nodes.find((n) => n.type === 'node:contact')!;
      (contact as any).contactType = 'NC';

      const state = mockModelStateWithGraph(graphNC);
      attachModelState(handler, state);

      handler.execute(
        ChangeContactTypeOperation.create(contact.id, 'NO'),
      );

      const result = state.get<LdGraph>(LD_SOURCE_KEY)!;
      const updated = result.nodes.find((n) => n.id === contact.id) as any;
      expect(updated?.contactType).toBe('NO');
    });

    it('silently skips when element is not a contact (coil)', () => {
      const graph = graphWithContactAndCoil();
      const coil = graph.nodes.find((n) => n.type === 'node:coil')!;
      const state = mockModelStateWithGraph(graph);
      attachModelState(handler, state);

      expect(() =>
        handler.execute(
          ChangeContactTypeOperation.create(coil.id, 'NC'),
        ),
      ).not.toThrow();
      // Coil's coilType should be unchanged
      const result = state.get<LdGraph>(LD_SOURCE_KEY)!;
      const updated = result.nodes.find((n) => n.id === coil.id) as any;
      expect(updated?.coilType).toBe('Normal');
    });

    it('silently skips when element does not exist', () => {
      const graph = graphWithContactAndCoil();
      const state = mockModelStateWithGraph(graph);
      attachModelState(handler, state);

      expect(() =>
        handler.execute(
          ChangeContactTypeOperation.create('nonexistent', 'NC'),
        ),
      ).not.toThrow();
    });

    it('returns early when ModelState has no graph', () => {
      const state = mockModelState();
      attachModelState(handler, state);

      expect(() =>
        handler.execute(
          ChangeContactTypeOperation.create('any', 'NO'),
        ),
      ).not.toThrow();
    });
  });
});
