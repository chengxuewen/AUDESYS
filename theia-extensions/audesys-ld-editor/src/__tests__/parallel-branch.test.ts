/**
 * Parallel branch tests — open/close/delete + OR compilation.
 * SDD: LD-BRANCH (P0-1, plan A1-A4) — branches are OR groups hanging off
 * a series anchor; the Rust LD compiler receives them as "| NO var" lines.
 */
import { describe, it, expect } from 'vitest';

import { LdOperationHandler } from '../backend/ld-operation-handler';
import { createLdGraph, LdGraph } from '../model/model';
import { ContactType, CoilType } from '../model/nodes';
import { COIL_X_OFFSET, BRANCH_FIRST_Y } from '../model/grid';

interface BranchFixture {
    handler: LdOperationHandler;
    graph: LdGraph;
    rungId: string;
    anchorId: string;
    branchId: string;
}

/**
 * Rung: contact (x=40) with a branch, member1 (y=120), member2 (y=160),
 * and a coil at the coil zone. Returns handler + final graph.
 */
function branchFixture(): BranchFixture {
    const handler = new LdOperationHandler(() => JSON.stringify({ instructions: [] }));
    let graph = handler.addRung(createLdGraph());
    const rungId = graph.rungs[0].id;
    graph = handler.addContact(graph, { position: { x: 40, y: 40 }, type: ContactType.NO, rungId });
    const anchorId = graph.rungs[0].elementIds[0];
    graph = handler.openBranch(graph, { rungId, anchorId });
    const branchId = graph.rungs[0].branches![0].id;
    graph = handler.addBranchContact(graph, { branchId, position: { x: 40, y: 0 } });
    graph = handler.addBranchContact(graph, { branchId, position: { x: 40, y: 0 } });
    return { handler, graph, rungId, anchorId, branchId };
}

function completeBranch(): { handler: LdOperationHandler; graph: LdGraph; rungId: string } {
    const fixture = branchFixture();
    const { handler, graph, rungId } = fixture;
    const withCoil = handler.addCoil(graph, {
        position: { x: COIL_X_OFFSET, y: 40 },
        type: CoilType.Normal,
        rungId,
    });
    return { handler, graph: withCoil, rungId };
}

describe('openBranch', () => {
    it('creates a branch record anchored at the contact', () => {
        // Arrange — fresh graph, open branch only (no members yet)
        const handler = new LdOperationHandler();
        let graph = handler.addRung(createLdGraph());
        const rungId = graph.rungs[0].id;
        graph = handler.addContact(graph, { position: { x: 40, y: 40 }, type: ContactType.NO, rungId });
        const anchorId = graph.rungs[0].elementIds[0];
        graph = handler.openBranch(graph, { rungId, anchorId });
        const branchId = graph.rungs[0].branches![0].id;

        // Assert
        const rung = graph.rungs[0];
        expect(rung.branches).toHaveLength(1);
        const branch = rung.branches![0];
        expect(branch.id).toBe(branchId);
        expect(branch.anchorId).toBe(anchorId);
        expect(branch.x).toBe(40);
        expect(branch.elementIds).toEqual([]);
    });

    it('rejects a non-contact anchor', () => {
        // Arrange
        const handler = new LdOperationHandler();
        const graph = handler.addRung(createLdGraph());
        const rungId = graph.rungs[0].id;

        // Act / Assert
        const rail = graph.nodes.find((n) => n.type === 'node:powerrail');
        expect(() => handler.openBranch(graph, { rungId, anchorId: rail!.id })).toThrow(/must be a contact/);
    });

    it('rejects a second branch at the same anchor', () => {
        // Arrange
        const { handler, graph, rungId, anchorId } = branchFixture();

        // Act / Assert
        expect(() => handler.openBranch(graph, { rungId, anchorId })).toThrow(/already exists/);
    });
});

describe('addBranchContact', () => {
    it('stacks members below the anchor at the branch column', () => {
        // Arrange / Act
        const { graph, branchId } = branchFixture();

        // Assert
        const branch = graph.rungs[0].branches![0];
        expect(branch.elementIds).toHaveLength(2);
        const [m1, m2] = branch.elementIds.map((id) => graph.nodes.find((n) => n.id === id));
        expect(m1?.position).toEqual({ x: 40, y: BRANCH_FIRST_Y });
        expect(m2?.position).toEqual({ x: 40, y: BRANCH_FIRST_Y + 40 });
        // members are contacts but NOT in the series elementIds
        expect(graph.rungs[0].elementIds).not.toContain(m1?.id);
        expect(graph.rungs[0].elementIds).not.toContain(m2?.id);
    });

    it('wires the branch chain: anchor→m1, m1→m2 (bus), m2→succ', () => {
        // Arrange — branch + coil so the chain closes at the coil
        const { handler, graph, rungId, branchId } = branchFixture();
        const withCoil = handler.addCoil(graph, {
            position: { x: COIL_X_OFFSET, y: 40 },
            type: CoilType.Normal,
            rungId,
        });
        const branch = withCoil.rungs[0].branches![0];
        const [m1, m2] = branch.elementIds;
        const coilId = withCoil.rungs[0].elementIds.find((id) => id !== branch.anchorId);

        // Act / Assert
        expect(withCoil.edges.some((e) => e.sourceId === branch.anchorId && e.targetId === m1)).toBe(true);
        expect(withCoil.edges.some((e) => e.sourceId === m1 && e.targetId === m2 && e.sourcePin === 'bus-out' && e.targetPin === 'bus-in')).toBe(true);
        expect(withCoil.edges.some((e) => e.sourceId === m2 && e.targetId === coilId)).toBe(true);
        // anchor→succ direct edge removed while the branch exists
        expect(withCoil.edges.some((e) => e.sourceId === branch.anchorId && e.targetId === coilId)).toBe(false);
    });

    it('throws for an unknown branch', () => {
        // Arrange
        const { handler, graph } = branchFixture();

        // Act / Assert
        expect(() => handler.addBranchContact(graph, { branchId: 'nope', position: { x: 0, y: 0 } }))
            .toThrow(/Branch not found/);
    });
});

describe('closeBranch / deleteBranch', () => {
    it('closeBranch rejects an empty branch', () => {
        // Arrange — open branch, no members
        const handler = new LdOperationHandler();
        let graph = handler.addRung(createLdGraph());
        const rungId = graph.rungs[0].id;
        graph = handler.addContact(graph, { position: { x: 40, y: 40 }, type: ContactType.NO, rungId });
        const anchorId = graph.rungs[0].elementIds[0];
        graph = handler.openBranch(graph, { rungId, anchorId });
        const branchId = graph.rungs[0].branches![0].id;

        // Act / Assert
        expect(() => handler.closeBranch(graph, { branchId })).toThrow(/empty branch/);
    });

    it('closeBranch accepts a branch with members', () => {
        // Arrange
        const { handler, graph, branchId } = branchFixture();

        // Act
        const next = handler.closeBranch(graph, { branchId });

        // Assert — same graph (validation-only operation)
        expect(next).toBe(graph);
    });

    it('deleteBranch removes members + edges and restores the series edge', () => {
        // Arrange — branch + coil so anchor→coil edge must be restored
        const { handler, graph, rungId, branchId } = branchFixture();
        const withCoil = handler.addCoil(graph, {
            position: { x: COIL_X_OFFSET, y: 40 },
            type: CoilType.Normal,
            rungId,
        });
        const branch = withCoil.rungs[0].branches![0];
        const memberIds = branch.elementIds;
        const anchorId = branch.anchorId;
        const coilId = withCoil.rungs[0].elementIds.find((id) => id !== anchorId);

        // Act
        const next = handler.deleteBranch(withCoil, { branchId });

        // Assert
        expect(next.rungs[0].branches).toEqual([]);
        expect(next.nodes.find((n) => n.id === memberIds[0])).toBeUndefined();
        expect(next.nodes.find((n) => n.id === memberIds[1])).toBeUndefined();
        expect(next.edges.some((e) => e.sourceId === anchorId && e.targetId === coilId)).toBe(true);
    });
});

describe('deleteElement with branches', () => {
    it('deleting the anchor drops the whole branch (members + edges)', () => {
        // Arrange
        const { handler, graph, anchorId } = branchFixture();
        const branch = graph.rungs[0].branches![0];
        const memberIds = branch.elementIds;
        const edgesBefore = graph.edges.length;
        expect(edgesBefore).toBeGreaterThan(0);

        // Act
        const next = handler.deleteElement(graph, { elementId: anchorId });

        // Assert
        expect(next.rungs[0].branches).toEqual([]);
        expect(next.nodes.find((n) => n.id === anchorId)).toBeUndefined();
        expect(next.nodes.find((n) => n.id === memberIds[0])).toBeUndefined();
        expect(next.edges.length).toBe(0);
    });

    it('deleting a member prunes it from the branch and rewires the chain', () => {
        // Arrange
        const { handler, graph, branchId } = branchFixture();
        const branch = graph.rungs[0].branches![0];
        const [m1, m2] = branch.elementIds;

        // Act — remove m2
        const next = handler.deleteElement(graph, { elementId: m2 });

        // Assert
        const nextBranch = next.rungs[0].branches![0];
        expect(nextBranch.elementIds).toEqual([m1]);
        expect(next.nodes.find((n) => n.id === m2)).toBeUndefined();
        // m1 no longer has a vertical bus edge to m2
        expect(next.edges.some((e) => e.sourceId === m1 && e.targetId === m2)).toBe(false);
        expect(next.edges.length).toBeGreaterThan(0); // chain still wired
    });
});

describe('compile with branches (OR semantics)', () => {
    function captureCompile(): { handler: LdOperationHandler; calls: string[] } {
        const calls: string[] = [];
        const handler = new LdOperationHandler((source) => {
            calls.push(source);
            return JSON.stringify({ instructions: [{ op: 'LD', var: 'IN0' }] });
        });
        return { handler, calls };
    }

    it('emits "| NO var" lines for branch members (Rust OR/ORN syntax)', () => {
        // Arrange
        const { handler, calls } = captureCompile();
        const { graph } = completeBranch();

        // Act
        const result = handler.compile(graph);

        // Assert
        expect(result.success).toBe(true);
        expect(calls).toHaveLength(1);
        const ldSource = calls[0];
        expect(ldSource).toContain('  NO IN0');      // anchor is a series contact
        expect(ldSource).toContain('  | NO IN1');    // member 1 → OR
        expect(ldSource).toContain('  | NO IN2');    // member 2 → OR
        expect(ldSource).toContain('  OUT OUT0');
    });

    it('emits "| NC var" for NC branch members (ORN)', () => {
        // Arrange
        const handler = new LdOperationHandler((source) => JSON.stringify({ instructions: [] }));
        const { graph, rungId, anchorId, branchId } = branchFixture();
        // flip member 1 to NC
        const member1 = graph.rungs[0].branches![0].elementIds[0];
        let next = handler.changeContactType(graph, { elementId: member1, newType: ContactType.NC });
        next = handler.addCoil(next, { position: { x: COIL_X_OFFSET, y: 40 }, type: CoilType.Normal, rungId });

        const calls: string[] = [];
        const capturing = new LdOperationHandler((source) => { calls.push(source); return JSON.stringify({ instructions: [] }); });
        const result = capturing.compile(next);

        // Assert
        expect(result.success).toBe(true);
        expect(calls[0]).toContain('  | NC IN1');
    });

    it('keeps backward compatibility — rung without branches compiles unchanged', () => {
        // Arrange
        const handler = new LdOperationHandler();
        let graph = handler.addRung(createLdGraph());
        const rungId = graph.rungs[0].id;
        graph = handler.addContact(graph, { position: { x: 40, y: 40 }, type: ContactType.NO, rungId });
        graph = handler.addContact(graph, { position: { x: 120, y: 40 }, type: ContactType.NO, rungId });
        graph = handler.addCoil(graph, { position: { x: COIL_X_OFFSET, y: 40 }, type: CoilType.Normal, rungId });

        const calls: string[] = [];
        const capturing = new LdOperationHandler((source) => { calls.push(source); return JSON.stringify({ instructions: [] }); });

        // Act
        const result = capturing.compile(graph);

        // Assert
        expect(result.success).toBe(true);
        expect(calls[0]).toBe('NETWORK\n  NO IN0\n  NO IN1\n  OUT OUT0');
    });

    it('validates branch structure (anchor missing → invalid)', () => {
        // Arrange
        const { handler, graph } = branchFixture();
        const broken: LdGraph = JSON.parse(JSON.stringify(graph));
        broken.nodes = broken.nodes.filter((n) => n.id !== broken.rungs[0].branches![0].anchorId);

        // Act
        const result = handler.validate(broken);

        // Assert
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('anchor'))).toBe(true);
    });
});
