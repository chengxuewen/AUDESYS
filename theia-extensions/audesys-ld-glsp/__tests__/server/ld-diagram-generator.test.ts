/**
 * T4.5: addArg propagation tests — verify contactType/coilType/fbType
 * are passed from LdGraph nodes to GLSP GNode args.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { LdDiagramGenerator, LD_SOURCE_KEY } from '../../src/server/ld-diagram-generator';
import { GModelRoot, GGraph, GNode } from '@eclipse-glsp/server';
import { LdGraph, createLdGraph, createContact, createCoil, createFb, createRung } from '../../src/gmodel/model';
import { ContactType, CoilType, PowerRailSide } from '../../src/gmodel/nodes';

class MockState {
    store = new Map<string, unknown>();
    root: GModelRoot = GGraph.builder().type('graph').id('empty').build();
    get<T>(key: string): T | undefined { return this.store.get(key) as T | undefined; }
    set<T>(key: string, value: T): void { this.store.set(key, value); }
    updateRoot(root: GModelRoot): void { this.root = root; }
}

function findGNode(root: GModelRoot, type: string): GNode | undefined {
    if (root instanceof GGraph) {
        return root.children.find((c): c is GNode => c instanceof GNode && c.type === type);
    }
    return undefined;
}

describe('LdDiagramGenerator addArg propagation', () => {
    let generator: LdDiagramGenerator;
    let state: MockState;

    beforeEach(() => {
        generator = new LdDiagramGenerator();
        state = new MockState();
        (generator as any).modelState = state;
    });

    it('buildContact passes contactType and variableName as args', () => {
        const graph = createLdGraph('arg-contact');
        const contact = createContact(ContactType.NC, 'X5', { x: 100, y: 100 });
        graph.nodes.push(contact);
        state.set(LD_SOURCE_KEY, graph);

        generator.createModel();

        const gNode = findGNode(state.root, 'node:contact');
        expect(gNode).toBeDefined();
        expect((gNode as any).args.contactType).toBe('NC');
        expect((gNode as any).args.variableName).toBe('X5');
    });

    it('buildCoil passes coilType and variableName as args', () => {
        const graph = createLdGraph('arg-coil');
        const coil = createCoil(CoilType.Set, 'Y7', { x: 200, y: 100 });
        graph.nodes.push(coil);
        state.set(LD_SOURCE_KEY, graph);

        generator.createModel();

        const gNode = findGNode(state.root, 'node:coil');
        expect(gNode).toBeDefined();
        expect((gNode as any).args.coilType).toBe('Set');
        expect((gNode as any).args.variableName).toBe('Y7');
    });

    it('buildFbPlaceholder passes fbType as arg', () => {
        const graph = createLdGraph('arg-fb');
        const fb = createFb('TON', [], [], { x: 300, y: 100 });
        graph.nodes.push(fb);
        state.set(LD_SOURCE_KEY, graph);

        generator.createModel();

        const gNode = findGNode(state.root, 'node:fb');
        expect(gNode).toBeDefined();
        expect((gNode as any).args.fbType).toBe('TON');
    });
});
