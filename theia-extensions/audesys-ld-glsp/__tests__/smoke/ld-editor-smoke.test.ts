/**
 * LD Editor Smoke Integration Test.
 *
 * End-to-end pipeline verification: create elements → compile → validate →
 * undo/redo → property changes. Uses the GModel factory functions,
 * LdOperationHandler, and LdGModelState together.
 */
import { describe, it, expect } from 'vitest';
import {
  LdOperationHandler,
} from '../../src/server/ld-operation-handler';
import { LdGModelState } from '../../src/server/ld-gmodel-state';
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
  PowerRailNode,
  ContactNode,
} from '../../src/gmodel/nodes';

// ============================================================================
// Helpers
// ============================================================================

/** Build a complete one-rung graph: left rail + contact + coil + right rail, wired. */
function buildSingleRungGraph(): LdGraph {
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

/** Count nodes of a given type in the graph. */
function countNodesByType(graph: LdGraph, type: string): number {
  return graph.nodes.filter((n) => n.type === type).length;
}

/** Mock compile function — returns valid HalProgram JSON. */
function mockCompile(_source: string): string {
  return JSON.stringify({
    name: 'test',
    signals: [],
    channels: [],
    instructions: [{ op: 'LD', operands: ['X1'] }, { op: 'ST', operands: ['Y1'] }],
    function_table: [],
  });
}

// ============================================================================
// Smoke Tests
// ============================================================================

describe('LD Editor Smoke Tests', () => {
  const handler = new LdOperationHandler();

  // ── Test 1: Create Simple Rung ────────────────────────────

  it('creates a simple rung with contact and coil', () => {
    const handler = new LdOperationHandler();

    // Start with empty graph
    let graph: LdGraph = createLdGraph();

    // Add a rung (first rung auto-adds left+right power rails)
    graph = handler.addRung(graph);
    expect(graph.rungs).toHaveLength(1);
    const rungId = graph.rungs[0].id;

    // Add NO contact
    graph = handler.addContact(graph, {
      position: { x: 100, y: 40 },
      type: ContactType.NO,
      rungId,
    });

    // Add coil
    graph = handler.addCoil(graph, {
      position: { x: 520, y: 40 },
      type: CoilType.Normal,
      rungId,
    });

    // Find elements for wiring
    const leftRail = graph.nodes.find(
      (n): n is PowerRailNode =>
        n.type === 'node:powerrail' && (n as PowerRailNode).side === PowerRailSide.Left,
    )!;
    const contact = graph.nodes.find((n) => n.type === 'node:contact')!;
    const coil = graph.nodes.find((n) => n.type === 'node:coil')!;

    // Wire: left rail → contact → coil
    graph = handler.connectWire(graph, { sourceId: leftRail.id, targetId: contact.id });
    graph = handler.connectWire(graph, { sourceId: contact.id, targetId: coil.id });

    // Verify structure
    expect(graph.nodes).toHaveLength(4); // 2 rails + 1 contact + 1 coil
    expect(graph.rungs).toHaveLength(1);
    expect(countNodesByType(graph, 'node:powerrail')).toBe(2);
    expect(countNodesByType(graph, 'node:contact')).toBe(1);
    expect(countNodesByType(graph, 'node:coil')).toBe(1);
  });

  // ── Test 2: Compile Valid Graph ──────────────────────────

  it('compiles a valid graph through the full pipeline', () => {
    const compileHandler = new LdOperationHandler(mockCompile);
    const graph = buildSingleRungGraph();

    // Validate first
    const validation = compileHandler.validate(graph);
    expect(validation.valid).toBe(true);

    // Compile
    const result = compileHandler.compile(graph);
    expect(result.success).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.programJson).toBeTruthy();
    expect(typeof result.programJson).toBe('string');

    // Verify output is parseable HalProgram JSON
    const parsed = JSON.parse(result.programJson);
    expect(parsed).toHaveProperty('instructions');
    expect(Array.isArray(parsed.instructions)).toBe(true);
  });

  // ── Test 3: Undo / Redo ──────────────────────────────────

  it('undo restores previous state and redo re-applies the change', () => {
    const graph = buildSingleRungGraph();
    const state = new LdGModelState(graph);

    const contactsBefore = countNodesByType(state.graph, 'node:contact');
    expect(contactsBefore).toBe(1);

    // Snapshot the current graph for comparison
    const snapshotJson = JSON.stringify(state.graph);

    // Add another contact
    const rungId = state.graph.rungs[0].id;
    state.applyOperation((g) =>
      handler.addContact(g, {
        position: { x: 200, y: 40 },
        type: ContactType.NC,
        rungId,
      }),
    );
    expect(countNodesByType(state.graph, 'node:contact')).toBe(2);

    // Undo
    const undone = state.undo();
    expect(undone).not.toBeNull();
    expect(countNodesByType(state.graph, 'node:contact')).toBe(1);
    expect(JSON.stringify(state.graph)).toBe(snapshotJson);

    // Redo
    const redone = state.redo();
    expect(redone).not.toBeNull();
    expect(countNodesByType(state.graph, 'node:contact')).toBe(2);
  });

  // ── Test 4: Validate Detects Issues ──────────────────────

  it('detects orphan nodes not in any rung', () => {
    const graph = createLdGraph();
    const orphan = createContact(ContactType.NO, 'orphan', { x: 100, y: 40 });

    const broken: LdGraph = {
      ...graph,
      nodes: [orphan],
      edges: [],
      rungs: [],
    };

    const result = handler.validate(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Orphan node') || e.includes('orphan'))).toBe(true);
  });

  it('detects empty rungs with no elements', () => {
    const graph = createLdGraph();
    const emptyRung = createRung(1, []);
    const broken: LdGraph = { ...graph, nodes: [], edges: [], rungs: [emptyRung] };

    const result = handler.validate(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('no elements'))).toBe(true);
  });

  // ── Test 5: Property Change ──────────────────────────────

  it('changes contact type from NO to NC', () => {
    const graph = buildSingleRungGraph();
    const contact = graph.nodes.find((n) => n.type === 'node:contact') as ContactNode | undefined;
    expect(contact).toBeDefined();
    expect(contact!.contactType).toBe('NO');

    const result = handler.changeContactType(graph, {
      elementId: contact!.id,
      newType: ContactType.NC,
    });

    const updated = result.nodes.find((n) => n.id === contact!.id) as ContactNode;
    expect(updated.contactType).toBe('NC');
  });

  it('changing to same type is idempotent', () => {
    const graph = buildSingleRungGraph();
    const contact = graph.nodes.find((n) => n.type === 'node:contact')!;

    const result = handler.changeContactType(graph, {
      elementId: contact.id,
      newType: ContactType.NO, // same as current
    });

    expect(result.nodes.length).toBe(graph.nodes.length);
    const unchanged = result.nodes.find((n) => n.id === contact.id) as ContactNode;
    expect(unchanged.contactType).toBe('NO');
  });
});
