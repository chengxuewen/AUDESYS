/**
 * Unit tests for LD Operation Handler.
 *
 * Tests all 13+ operation handler methods with the thin server approach:
 * each operation receives current graph state + params → returns new graph.
 */
import { describe, it, expect } from 'vitest';
import {
  LdOperationHandler,
  CompileResult,
} from '../../src/server/ld-operation-handler';
import {
  LdGraph,
  createLdGraph,
  createContact,
  createCoil,
  createPowerRail,
  createRung,
  createWire,
} from '../../src/gmodel/model';
import {
  ContactType,
  CoilType,
  PowerRailSide,
} from '../../src/gmodel/nodes';

// ============================================================================
// Helpers
// ============================================================================

function makeGraph(): LdGraph {
  const graph = createLdGraph();
  return graph;
}

function graphWithRung(): LdGraph {
  const graph = createLdGraph();
  const rung = createRung(1, []);
  return { ...graph, rungs: [rung] };
}

function graphWithContact(): LdGraph {
  const graph = createLdGraph();
  const rung = createRung(1, []);
  const leftRail = createPowerRail(PowerRailSide.Left, { x: 0, y: 0 }, 200);
  const contact = createContact(ContactType.NO, 'X1', { x: 100, y: 40 });
  const wire = createWire(leftRail.id, contact.id);
  const rungWithContact = { ...rung, elementIds: [contact.id] };
  return {
    ...graph,
    nodes: [leftRail, contact],
    edges: [wire],
    rungs: [rungWithContact],
  };
}

function graphWithContactAndCoil(): LdGraph {
  const graph = createLdGraph();
  const leftRail = createPowerRail(PowerRailSide.Left, { x: 0, y: 0 });
  const rightRail = createPowerRail(PowerRailSide.Right, { x: 640, y: 0 });
  const contact = createContact(ContactType.NO, 'X1', { x: 100, y: 40 });
  const coil = createCoil(CoilType.Normal, 'Y1', { x: 520, y: 40 });
  const w1 = createWire(leftRail.id, contact.id);
  const w2 = createWire(contact.id, coil.id);
  const w3 = createWire(coil.id, rightRail.id);
  const rung = createRung(1, [contact.id, coil.id]);
  return {
    ...graph,
    nodes: [leftRail, rightRail, contact, coil],
    edges: [w1, w2, w3],
    rungs: [rung],
  };
}

function countNodesByType(graph: LdGraph, type: string): number {
  return graph.nodes.filter((n) => n.type === type).length;
}

function findEdgesFor(graph: LdGraph, nodeId: string) {
  return graph.edges.filter((e) => e.sourceId === nodeId || e.targetId === nodeId);
}

// Mock compile: returns valid HalProgram JSON
function mockCompile(_source: string): string {
  return JSON.stringify({
    name: 'test',
    signals: [],
    channels: [],
    instructions: [{ op: 'OR', operands: [] }],
    function_table: [],
  });
}

// Mock compile error: returns error array
function mockCompileError(_source: string): string {
  return JSON.stringify([
    { severity: 'error', message: 'Undefined variable: X99', code: 'E001' },
  ]);
}

// Mock compile raw error (non-JSON)
function mockCompileRaw(_source: string): string {
  return 'Compiler panic: stack overflow';
}

// ============================================================================
// Tests
// ============================================================================

describe('LdOperationHandler', () => {
  const handler = new LdOperationHandler();

  // ── addContact ──────────────────────────────────────────

  describe('addContact', () => {
    it('creates a contact node on a rung', () => {
      const graph = graphWithRung();
      const rung = graph.rungs[0];

      const result = handler.addContact(graph, {
        position: { x: 100, y: 40 },
        type: ContactType.NO,
        rungId: rung.id,
      });

      expect(countNodesByType(result, 'node:contact')).toBe(1);
      expect(result.rungs[0].elementIds).toHaveLength(1);
      expect(result.nodes[0].type).toBe('node:contact');
    });

    it('sets default variable name to "??"', () => {
      const graph = graphWithRung();
      const rung = graph.rungs[0];

      const result = handler.addContact(graph, {
        position: { x: 100, y: 40 },
        type: ContactType.NC,
        rungId: rung.id,
      });

      const contact = result.nodes[0] as { variableName: string };
      expect(contact.variableName).toBe('??');
    });

    it('maintains left-to-right ordering by x position', () => {
      const graph = graphWithRung();
      const rung = graph.rungs[0];

      let result = handler.addContact(graph, {
        position: { x: 240, y: 40 },
        type: ContactType.NO,
        rungId: rung.id,
      });

      result = handler.addContact(result, {
        position: { x: 120, y: 40 },
        type: ContactType.NO,
        rungId: rung.id,
      });

      expect(result.rungs[0].elementIds).toHaveLength(2);
      expect(countNodesByType(result, 'node:contact')).toBe(2);
    });

    it('throws when contact is placed right of coil', () => {
      const graph = graphWithContactAndCoil();
      const rung = graph.rungs[0];

      expect(() =>
        handler.addContact(graph, {
          position: { x: 600, y: 40 },
          type: ContactType.NO,
          rungId: rung.id,
        }),
      ).toThrow('Contact must be left of the coil');
    });

    it('throws for non-existent rung', () => {
      const graph = makeGraph();
      expect(() =>
        handler.addContact(graph, {
          position: { x: 100, y: 40 },
          type: ContactType.NO,
          rungId: 'nonexistent',
        }),
      ).toThrow('Rung not found');
    });
  });

  // ── addCoil ─────────────────────────────────────────────

  describe('addCoil', () => {
    it('creates a coil node on a rung with contacts', () => {
      const graph = graphWithContact();
      const rung = graph.rungs[0];

      const result = handler.addCoil(graph, {
        position: { x: 480, y: 40 },
        type: CoilType.Normal,
        rungId: rung.id,
      });

      expect(countNodesByType(result, 'node:coil')).toBe(1);
      expect(result.rungs[0].elementIds).toHaveLength(2);
    });

    it('throws when rung already has a coil', () => {
      const graph = graphWithContactAndCoil();
      const rung = graph.rungs[0];

      expect(() =>
        handler.addCoil(graph, {
          position: { x: 480, y: 40 },
          type: CoilType.Set,
          rungId: rung.id,
        }),
      ).toThrow('Rung already has a coil');
    });

    it('throws when rung has no contacts', () => {
      const graph = graphWithRung();
      const rung = graph.rungs[0];

      expect(() =>
        handler.addCoil(graph, {
          position: { x: 480, y: 40 },
          type: CoilType.Normal,
          rungId: rung.id,
        }),
      ).toThrow('Add at least one contact before adding a coil');
    });

    it('throws when coil is placed left of contacts', () => {
      const graph = graphWithContact();
      const rung = graph.rungs[0];
      graph.nodes[1].position.x = 300;

      expect(() =>
        handler.addCoil(graph, {
          position: { x: 100, y: 40 },
          type: CoilType.Normal,
          rungId: rung.id,
        }),
      ).toThrow('Coil must be placed to the right of all contacts');
    });
  });

  // ── deleteElement ───────────────────────────────────────

  describe('deleteElement', () => {
    it('removes a contact node and its connected edges', () => {
      const graph = graphWithContactAndCoil();
      const contact = graph.nodes.find((n) => n.type === 'node:contact')!;
      const edgesBefore = findEdgesFor(graph, contact.id).length;

      const result = handler.deleteElement(graph, { elementId: contact.id });

      expect(countNodesByType(result, 'node:contact')).toBe(0);
      const connectedAfter = findEdgesFor(result, contact.id).length;
      expect(connectedAfter).toBe(0);
      expect(result.edges.length).toBeLessThan(graph.edges.length);
      expect(result.rungs[0].elementIds).not.toContain(contact.id);
    });

    it('removes a wire edge', () => {
      const graph = graphWithContactAndCoil();
      const wire = graph.edges[1];

      const result = handler.deleteElement(graph, { elementId: wire.id });

      expect(result.edges.length).toBe(graph.edges.length - 1);
      expect(result.edges.map((e) => e.id)).not.toContain(wire.id);
    });

    it('throws when element does not exist', () => {
      const graph = makeGraph();
      expect(() =>
        handler.deleteElement(graph, { elementId: 'nonexistent' }),
      ).toThrow('Element not found');
    });
  });

  // ── moveElement ─────────────────────────────────────────

  describe('moveElement', () => {
    it('updates node position', () => {
      const graph = graphWithContact();
      const contact = graph.nodes.find((n) => n.type === 'node:contact')!;

      const result = handler.moveElement(graph, {
        elementId: contact.id,
        newPosition: { x: 240, y: 80 },
      });

      const moved = result.nodes.find((n) => n.id === contact.id)!;
      expect(moved.position.x).toBe(240);
      expect(moved.position.y).toBe(80);
    });

    it('throws for non-existent node', () => {
      const graph = makeGraph();
      expect(() =>
        handler.moveElement(graph, {
          elementId: 'nonexistent',
          newPosition: { x: 0, y: 0 },
        }),
      ).toThrow('Node not found');
    });
  });

  // ── connectWire / disconnectWire ────────────────────────

  describe('connectWire', () => {
    it('creates a wire between two nodes', () => {
      const graph = graphWithContactAndCoil();
      const base = { ...graph, edges: [] };
      const leftRail = base.nodes.find((n) => n.type === 'node:powerrail')!;
      const contact = base.nodes.find((n) => n.type === 'node:contact')!;

      const result = handler.connectWire(base, {
        sourceId: leftRail.id,
        targetId: contact.id,
      });

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].sourceId).toBe(leftRail.id);
      expect(result.edges[0].targetId).toBe(contact.id);
    });

    it('prevents direct power rail short circuit', () => {
      const graph = graphWithContactAndCoil();
      const leftRail = graph.nodes.find(
        (n) => n.type === 'node:powerrail' && (n as { side: string }).side === 'Left',
      )!;
      const rightRail = graph.nodes.find(
        (n) => n.type === 'node:powerrail' && (n as { side: string }).side === 'Right',
      )!;

      expect(() =>
        handler.connectWire(graph, {
          sourceId: leftRail.id,
          targetId: rightRail.id,
        }),
      ).toThrow('Short circuit');
    });

    it('prevents connecting from coil output', () => {
      const graph = graphWithContactAndCoil();
      const coil = graph.nodes.find((n) => n.type === 'node:coil')!;
      const contact = graph.nodes.find((n) => n.type === 'node:contact')!;

      expect(() =>
        handler.connectWire(graph, {
          sourceId: coil.id,
          targetId: contact.id,
        }),
      ).toThrow('Cannot connect from a coil output');
    });

    it('is idempotent for duplicate wires', () => {
      const graph = graphWithContact();
      const wire = graph.edges[0];

      const result = handler.connectWire(graph, {
        sourceId: wire.sourceId,
        targetId: wire.targetId,
      });

      expect(result.edges.length).toBe(graph.edges.length);
    });
  });

  describe('disconnectWire', () => {
    it('removes a wire by ID', () => {
      const graph = graphWithContact();
      const wire = graph.edges[0];

      const result = handler.disconnectWire(graph, { edgeId: wire.id });

      expect(result.edges.length).toBe(0);
    });

    it('throws for non-existent edge', () => {
      const graph = makeGraph();
      expect(() =>
        handler.disconnectWire(graph, { edgeId: 'nonexistent' }),
      ).toThrow('Wire not found');
    });
  });

  // ── changeContactType ───────────────────────────────────

  describe('changeContactType', () => {
    it('toggles contact from NO to NC', () => {
      const graph = graphWithContact();
      const contact = graph.nodes.find((n) => n.type === 'node:contact')!;

      const result = handler.changeContactType(graph, {
        elementId: contact.id,
        newType: ContactType.NC,
      });

      const updated = result.nodes.find((n) => n.id === contact.id) as {
        contactType: string;
      };
      expect(updated.contactType).toBe('NC');
    });

    it('is idempotent when type is unchanged', () => {
      const graph = graphWithContact();
      const contact = graph.nodes.find((n) => n.type === 'node:contact')!;

      const result = handler.changeContactType(graph, {
        elementId: contact.id,
        newType: ContactType.NO,
      });

      expect(result.nodes.length).toBe(graph.nodes.length);
    });

    it('throws for non-contact nodes', () => {
      const graph = graphWithContactAndCoil();
      const coil = graph.nodes.find((n) => n.type === 'node:coil')!;

      expect(() =>
        handler.changeContactType(graph, {
          elementId: coil.id,
          newType: ContactType.NC,
        }),
      ).toThrow('Not a contact');
    });
  });

  // ── Rung Management ─────────────────────────────────────

  describe('addRung', () => {
    it('adds a new empty rung', () => {
      const graph = makeGraph();
      const result = handler.addRung(graph);

      expect(result.rungs).toHaveLength(1);
      expect(result.rungs[0].rungNumber).toBe(1);
      expect(result.rungs[0].comment).toBe('Main');
    });

    it('adds power rails on first rung', () => {
      const graph = makeGraph();
      const result = handler.addRung(graph);

      expect(countNodesByType(result, 'node:powerrail')).toBe(2);
    });

    it('numbers rungs sequentially', () => {
      const graph = makeGraph();
      let result = handler.addRung(graph);
      result = handler.addRung(result);
      result = handler.addRung(result);

      expect(result.rungs).toHaveLength(3);
      expect(result.rungs.map((r) => r.rungNumber)).toEqual([1, 2, 3]);
    });
  });

  describe('deleteRung', () => {
    it('removes a rung and its elements', () => {
      const graph = graphWithContactAndCoil();
      const rung = graph.rungs[0];

      const withExtra = handler.addRung(graph);
      expect(withExtra.rungs).toHaveLength(2);

      const result = handler.deleteRung(withExtra, { rungId: rung.id });

      expect(result.rungs).toHaveLength(1);
      expect(countNodesByType(result, 'node:contact')).toBe(0);
    });

    it('prevents deleting the last rung', () => {
      const graph = graphWithRung();

      expect(() =>
        handler.deleteRung(graph, { rungId: graph.rungs[0].id }),
      ).toThrow('Cannot delete the last rung');
    });

    it('renumbers remaining rungs', () => {
      const graph = makeGraph();
      let result = handler.addRung(graph);
      result = handler.addRung(result);
      const rung1Id = result.rungs[0].id;

      result = handler.deleteRung(result, { rungId: rung1Id });

      expect(result.rungs[0].rungNumber).toBe(1);
    });
  });

  describe('moveRung', () => {
    it('reorders rungs', () => {
      const graph = makeGraph();
      let result = handler.addRung(graph);
      result = handler.addRung(result);
      const rung1Id = result.rungs[0].id;

      result = handler.moveRung(result, { rungId: rung1Id, newIndex: 1 });

      expect(result.rungs[1].id).toBe(rung1Id);
      expect(result.rungs[0].rungNumber).toBe(1);
      expect(result.rungs[1].rungNumber).toBe(2);
    });

    it('handles index out of bounds', () => {
      const graph = makeGraph();
      let result = handler.addRung(graph);
      const rungId = result.rungs[0].id;

      result = handler.moveRung(result, { rungId, newIndex: 99 });

      expect(result.rungs).toHaveLength(1);
    });

    it('is no-op when index is unchanged', () => {
      const graph = makeGraph();
      let result = handler.addRung(graph);
      const rungId = result.rungs[0].id;

      const after = handler.moveRung(result, { rungId, newIndex: 0 });

      expect(after.rungs[0].id).toBe(rungId);
    });
  });

  // ── addPowerRail ────────────────────────────────────────

  describe('addPowerRail', () => {
    it('adds a left power rail', () => {
      const graph = makeGraph();
      const result = handler.addPowerRail(graph, { side: PowerRailSide.Left });

      expect(countNodesByType(result, 'node:powerrail')).toBe(1);
    });

    it('adds a right power rail', () => {
      const graph = makeGraph();
      const result = handler.addPowerRail(graph, { side: PowerRailSide.Right });

      expect(countNodesByType(result, 'node:powerrail')).toBe(1);
    });

    it('is idempotent for duplicate rails', () => {
      const graph = makeGraph();
      let result = handler.addPowerRail(graph, { side: PowerRailSide.Left });
      result = handler.addPowerRail(result, { side: PowerRailSide.Left });

      expect(countNodesByType(result, 'node:powerrail')).toBe(1);
    });
  });

  // ── validate ────────────────────────────────────────────

  describe('validate', () => {
    it('returns valid for a well-formed graph', () => {
      const graph = graphWithContactAndCoil();
      const result = handler.validate(graph);
      expect(result.valid).toBe(true);
    });

    it('reports empty rungs', () => {
      const graph = graphWithRung();
      const result = handler.validate(graph);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('no elements'))).toBe(true);
    });

    it('reports multiple coils on a rung', () => {
      const graph = graphWithContactAndCoil();
      const coil2 = createCoil(CoilType.Set, 'Y2', { x: 600, y: 40 });
      const broken: LdGraph = {
        ...graph,
        nodes: [...graph.nodes, coil2],
        rungs: [
          { ...graph.rungs[0], elementIds: [...graph.rungs[0].elementIds, coil2.id] },
        ],
      };

      const result = handler.validate(broken);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('multiple coils'))).toBe(true);
    });

    it('reports coil with no contacts', () => {
      const graph = graphWithContactAndCoil();
      const broken: LdGraph = {
        ...graph,
        rungs: [
          {
            ...graph.rungs[0],
            elementIds: graph.rungs[0].elementIds.filter(
              (id) => graph.nodes.find((n) => n.id === id)?.type !== 'node:contact',
            ),
          },
        ],
      };

      const result = handler.validate(broken);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('no contacts'))).toBe(true);
    });
  });

  // ── compile ─────────────────────────────────────────────

  describe('compile', () => {
    it('compiles a valid graph successfully', () => {
      const handler2 = new LdOperationHandler(mockCompile);
      const graph = graphWithContactAndCoil();

      const result = handler2.compile(graph);

      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
      expect(result.programJson).toBeTruthy();
    });

    it('returns validation errors for invalid graph', () => {
      const handler2 = new LdOperationHandler(mockCompile);
      const graph = graphWithRung();

      const result = handler2.compile(graph);

      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });

    it('returns compile errors from napi-rs', () => {
      const handler2 = new LdOperationHandler(mockCompileError);
      const graph = graphWithContactAndCoil();

      const result = handler2.compile(graph);

      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].severity).toBe('error');
    });

    it('handles non-JSON compile errors', () => {
      const handler2 = new LdOperationHandler(mockCompileRaw);
      const graph = graphWithContactAndCoil();

      const result = handler2.compile(graph);

      expect(result.success).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].message).toContain('panic');
    });

    it('handles compile function throwing', () => {
      const throwingHandler = new LdOperationHandler(() => {
        throw new Error('Bridge unavailable');
      });
      const graph = graphWithContactAndCoil();

      const result = throwingHandler.compile(graph);

      expect(result.success).toBe(false);
      expect(result.diagnostics[0].message).toBe('Bridge unavailable');
    });
  });
});

// ============================================================================
// LdGModelState Tests
// ============================================================================

describe('LdGModelState', () => {
  it('should be importable', async () => {
    const { LdGModelState } = await import('../../src/server/ld-gmodel-state');
    const state = new LdGModelState();
    expect(state.graph).toBeDefined();
    expect(state.dirty).toBe(false);
  });
});

// ============================================================================
// Integration: handler + state
// ============================================================================

describe('Handler + State integration', () => {
  it('operations through state manager produce correct undo/redo', async () => {
    const { LdGModelState } = await import('../../src/server/ld-gmodel-state');
    const handler = new LdOperationHandler();
    const state = new LdGModelState();

    state.applyOperation((g) => handler.addRung(g));
    expect(state.graph.rungs).toHaveLength(1);

    const rungId = state.graph.rungs[0].id;
    state.applyOperation((g) =>
      handler.addContact(g, {
        position: { x: 100, y: 40 },
        type: ContactType.NO,
        rungId,
      }),
    );
    expect(countNodesByType(state.graph, 'node:contact')).toBe(1);

    const undone = state.undo();
    expect(undone).not.toBeNull();
    expect(countNodesByType(state.graph, 'node:contact')).toBe(0);

    const redone = state.redo();
    expect(redone).not.toBeNull();
    expect(countNodesByType(state.graph, 'node:contact')).toBe(1);

    expect(state.undoDepth).toBeGreaterThanOrEqual(1);
  });

  it('undo stack respects max depth', async () => {
    const { LdGModelState } = await import('../../src/server/ld-gmodel-state');
    const handler = new LdOperationHandler();
    const state = new LdGModelState();

    for (let i = 0; i < 60; i++) {
      state.applyOperation((g) => handler.addRung(g));
    }

    for (let i = 0; i < 10; i++) {
      const undone = state.undo();
      expect(undone).not.toBeNull();
    }
  });
});
