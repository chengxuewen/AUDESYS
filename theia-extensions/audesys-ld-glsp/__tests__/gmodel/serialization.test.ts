/**
 * Unit tests for LD GModel JSON serialization and validation.
 */
import { describe, it, expect } from 'vitest';
import {
  LdGraph,
  createContact,
  createCoil,
  createPowerRail,
  createRung,
  createWire,
  createLdGraph,
} from '../../src/gmodel/model';
import { ContactType, CoilType, PowerRailSide } from '../../src/gmodel/nodes';
import { toJSON, fromJSON, validateGraph, isValid, roundTrip } from '../../src/gmodel/serialization';

// ============================================================================
// Helpers
// ============================================================================

function makeContact(): ReturnType<typeof createContact> {
  return createContact(ContactType.NO, 'X1', { x: 100, y: 40 });
}

function makeCoil(): ReturnType<typeof createCoil> {
  return createCoil(CoilType.Normal, 'Y1', { x: 300, y: 40 });
}

function makeFullGraph(): LdGraph {
  const leftRail = createPowerRail(PowerRailSide.Left, { x: 0, y: 0 }, 200);
  const rightRail = createPowerRail(PowerRailSide.Right, { x: 500, y: 0 }, 200);
  const contact1 = createContact(ContactType.NO, 'X1', { x: 100, y: 40 });
  const contact2 = createContact(ContactType.NC, 'X2', { x: 180, y: 40 });
  const coil = createCoil(CoilType.Normal, 'Y1', { x: 300, y: 40 });

  const wire1 = createWire(leftRail.id, contact1.id);
  const wire2 = createWire(contact1.id, contact2.id);
  const wire3 = createWire(contact2.id, coil.id);
  const wire4 = createWire(coil.id, rightRail.id);

  const rung = createRung(1, [leftRail.id, contact1.id, contact2.id, coil.id, rightRail.id], 'Test rung');

  return {
    id: 'test-graph-1',
    nodes: [leftRail, rightRail, contact1, contact2, coil],
    edges: [wire1, wire2, wire3, wire4],
    rungs: [rung],
  };
}

// ============================================================================
// Round-trip serialization
// ============================================================================

describe('toJSON / fromJSON round-trip', () => {
  it('preserves ContactNode through round-trip', () => {
    const contact = makeContact();
    const graph: LdGraph = {
      id: 'g1',
      nodes: [contact],
      edges: [],
      rungs: [createRung(1, [contact.id])],
    };

    const json = toJSON(graph);
    const restored = fromJSON(json);

    expect(restored.nodes).toHaveLength(1);
    const restoredNode = restored.nodes[0] as ReturnType<typeof createContact>;
    expect(restoredNode.id).toBe(contact.id);
    expect(restoredNode.type).toBe('node:contact');
    expect(restoredNode.contactType).toBe(ContactType.NO);
    expect(restoredNode.variableName).toBe('X1');
    expect(restoredNode.position).toEqual({ x: 100, y: 40 });
    expect(restoredNode.size).toEqual({ width: 36, height: 36 });
  });

  it('preserves CoilNode through round-trip', () => {
    const coil = makeCoil();
    const graph: LdGraph = {
      id: 'g2',
      nodes: [coil],
      edges: [],
      rungs: [createRung(1, [coil.id])],
    };

    const json = toJSON(graph);
    const restored = fromJSON(json);

    expect(restored.nodes).toHaveLength(1);
    const restoredNode = restored.nodes[0] as ReturnType<typeof createCoil>;
    expect(restoredNode.id).toBe(coil.id);
    expect(restoredNode.type).toBe('node:coil');
    expect(restoredNode.coilType).toBe(CoilType.Normal);
    expect(restoredNode.variableName).toBe('Y1');
  });

  it('preserves full graph (2 contacts + 1 coil + wire + rung)', () => {
    const graph = makeFullGraph();
    const json = toJSON(graph);
    const restored = fromJSON(json);

    expect(restored.id).toBe('test-graph-1');
    expect(restored.nodes).toHaveLength(5);
    expect(restored.edges).toHaveLength(4);
    expect(restored.rungs).toHaveLength(1);

    // verify nodes
    const nodeTypes = restored.nodes.map((n) => n.type);
    expect(nodeTypes).toEqual(
      expect.arrayContaining(['node:powerrail', 'node:powerrail', 'node:contact', 'node:contact', 'node:coil']),
    );

    // verify rung
    expect(restored.rungs[0].rungNumber).toBe(1);
    expect(restored.rungs[0].elementIds).toHaveLength(5);
    expect(restored.rungs[0].comment).toBe('Test rung');

    // roundTrip helper
    expect(roundTrip(graph)).toBe(true);
  });
});

// ============================================================================
// Validation
// ============================================================================

describe('validateGraph', () => {
  it('returns valid=true for a valid graph', () => {
    const graph = makeFullGraph();
    const result = validateGraph(graph);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(isValid(graph)).toBe(true);
  });

  it('detects orphan nodes not referenced by any rung', () => {
    const contact = makeContact();
    const graph: LdGraph = {
      id: 'orphan-test',
      nodes: [contact],
      edges: [],
      rungs: [],
    };

    const result = validateGraph(graph);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Orphan node'))).toBe(true);
    expect(result.errors.some((e) => e.includes(contact.id))).toBe(true);
  });

  it('detects invalid edge references (dangling source)', () => {
    const contact = makeContact();
    const graph: LdGraph = {
      id: 'dangling-test',
      nodes: [contact],
      edges: [{
        id: 'bad-edge',
        type: 'edge:wire',
        sourceId: 'non-existent-id',
        targetId: contact.id,
      }],
      rungs: [createRung(1, [contact.id])],
    };

    const result = validateGraph(graph);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Dangling edge source'))).toBe(true);
  });

  it('detects invalid edge references (dangling target)', () => {
    const contact = makeContact();
    const graph: LdGraph = {
      id: 'dangling-target-test',
      nodes: [contact],
      edges: [{
        id: 'bad-edge',
        type: 'edge:wire',
        sourceId: contact.id,
        targetId: 'non-existent-id',
      }],
      rungs: [createRung(1, [contact.id])],
    };

    const result = validateGraph(graph);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Dangling edge target'))).toBe(true);
  });

  it('detects rung referencing non-existent node', () => {
    const contact = makeContact();
    const graph: LdGraph = {
      id: 'bad-rung-ref',
      nodes: [contact],
      edges: [],
      rungs: [{
        id: 'rung-1',
        rungNumber: 1,
        elementIds: ['non-existent-id'],
      }],
    };

    const result = validateGraph(graph);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Invalid rung reference'))).toBe(true);
  });

  it('detects empty rung', () => {
    const graph: LdGraph = {
      id: 'empty-rung',
      nodes: [],
      edges: [],
      rungs: [{ id: 'r1', rungNumber: 1, elementIds: [] }],
    };

    const result = validateGraph(graph);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Empty rung'))).toBe(true);
  });

  it('validates a graph with only power rails', () => {
    const leftRail = createPowerRail(PowerRailSide.Left);
    const rightRail = createPowerRail(PowerRailSide.Right);
    const graph: LdGraph = {
      id: 'rails-only',
      nodes: [leftRail, rightRail],
      edges: [],
      rungs: [createRung(1, [leftRail.id])],
    };

    const result = validateGraph(graph);

    // rightRail is orphan
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain(rightRail.id);
  });
});
