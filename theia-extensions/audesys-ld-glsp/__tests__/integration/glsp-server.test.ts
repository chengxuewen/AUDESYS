/**
 * GLSP 服务端集成测试 — LdDiagramModule 完整生命周期。
 *
 * 直接实例化 handlers 和 storage, mock ModelState, 不需要启动 socket server。
 * 测试路径: 创建模块 → 加载空模型 → 创建节点 → 删除节点 → 保存。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GModelRoot, GGraph, GNode, GEdge } from '@eclipse-glsp/server';
import { CreateNodeOperation, DeleteElementOperation, RequestModelAction, SaveModelAction } from '@eclipse-glsp/protocol';
import { GModelIndex } from '@eclipse-glsp/server';
import { LdSourceModelStorage, LdCreateNodeHandler, LdDeleteHandler, LdChangeContactTypeHandler, LdDiagramGenerator, LdDiagramConfiguration, LdDiagramModule, ChangeContactTypeOperation, LD_SOURCE_KEY } from '../../src/server/index';
import { LdGraph, createLdGraph, createContact, createCoil, createRung, createPowerRail, createWire } from '../../src/gmodel/model';
import { ContactType, CoilType, PowerRailSide } from '../../src/gmodel/nodes';

class MockModelState {
    private store = new Map<string, unknown>();
    private _root: GModelRoot = GGraph.builder().type('graph').id('empty').build();
    get root(): GModelRoot { return this._root; }
    get isReadonly(): boolean { return false; }
    get clientId(): string { return 'test-client'; }
    get index(): GModelIndex { return new GModelIndex(); }
    editMode = 'editable' as any;
    sourceUri?: string = '/test/ld-diagram.json';
    get<P>(key: string, _guard?: (object: unknown) => object is P): P | undefined {
        return this.store.get(key) as P | undefined;
    }
    set<P>(key: string, property: P): void { this.store.set(key, property); }
    setAll(properties: Record<string, unknown>): void {
        for (const [k, v] of Object.entries(properties)) { this.store.set(k, v); }
    }
    clear(key: string): void { this.store.delete(key); }
    updateRoot(newRoot: GModelRoot): void { this._root = newRoot; }
}

function createMockState(): MockModelState { return new MockModelState(); }
function injectState(instance: any, state: MockModelState): void { instance.modelState = state; }
function countNodes(graph: LdGraph): number { return graph.nodes.length; }
function countEdges(graph: LdGraph): number { return graph.edges.length; }
function countGModelNodes(root: GModelRoot): number {
    if (root instanceof GGraph) { return root.children.filter((c) => c instanceof GNode).length; }
    return 0;
}
function countGModelEdges(root: GModelRoot): number {
    if (root instanceof GGraph) { return root.children.filter((c) => c instanceof GEdge).length; }
    return 0;
}

describe('LdDiagramModule — 集成测试', () => {

    describe('模块配置', () => {
        it('diagramType 正确', () => {
            const mod = new LdDiagramModule();
            expect(mod.diagramType).toBe('ld-diagram');
        });
        it('LdDiagramConfiguration 提供正确的 shape type hints', () => {
            const config = new LdDiagramConfiguration();
            expect(config.layoutKind).toBe(2);
            expect(config.needsClientLayout).toBe(true);
            const contactHint = config.shapeTypeHints.find((h) => h.elementTypeId === 'node:contact');
            expect(contactHint).toBeDefined();
            expect(contactHint!.deletable).toBe(true);
            expect(contactHint!.repositionable).toBe(true);
            const coilHint = config.shapeTypeHints.find((h) => h.elementTypeId === 'node:coil');
            expect(coilHint).toBeDefined();
            expect(coilHint!.deletable).toBe(true);
            const railHint = config.shapeTypeHints.find((h) => h.elementTypeId === 'node:powerrail');
            expect(railHint).toBeDefined();
            expect(railHint!.deletable).toBe(false);
            expect(railHint!.repositionable).toBe(false);
        });
        it('LdDiagramConfiguration 提供 edge type hints', () => {
            const config = new LdDiagramConfiguration();
            const wireHint = (config.edgeTypeHints as any[]).find((h) => h.elementTypeId === 'edge:wire');
            expect(wireHint).toBeDefined();
            expect(wireHint!.deletable).toBe(true);
            expect(wireHint!.sourceElementTypeIds).toContain('node:contact');
            expect(wireHint!.targetElementTypeIds).toContain('node:coil');
        });
    });

    describe('LdSourceModelStorage', () => {
        let storage: LdSourceModelStorage;
        let state: MockModelState;
        beforeEach(() => {
            storage = new LdSourceModelStorage();
            state = createMockState();
            injectState(storage, state);
        });
        it('loadSourceModel 创建带初始 rung 的 LdGraph', () => {
            storage.loadSourceModel(RequestModelAction.create());
            const graph = state.get<LdGraph>(LD_SOURCE_KEY);
            expect(graph).toBeDefined();
            expect(graph!.id).toBeTruthy();
            // 空图自动获得初始 rung + 2 电源轨 (insert 容器)
            expect(graph!.rungs).toHaveLength(1);
            expect(graph!.nodes).toHaveLength(2);
            expect(graph!.edges).toHaveLength(0);
        });
        it('loadSourceModel 保留已有源模型', () => {
            const existing = createLdGraph('test-id');
            existing.nodes.push(createContact(ContactType.NO, 'X1', { x: 100, y: 40 }));
            state.set(LD_SOURCE_KEY, existing);
            storage.loadSourceModel(RequestModelAction.create());
            const graph = state.get<LdGraph>(LD_SOURCE_KEY);
            expect(graph!.id).toBe('test-id');
            expect(countNodes(graph!)).toBe(1);
        });
        it('saveSourceModel 序列化 LdGraph 为 JSON', () => {
            const graph = createLdGraph();
            graph.rungs.push(createRung(1, []));
            state.set(LD_SOURCE_KEY, graph);
            storage.saveSourceModel(SaveModelAction.create());
            const json = state.get<string>('ld-source-json');
            expect(json).toBeDefined();
            expect(json).toContain('"rungs"');
            const parsed = JSON.parse(json!);
            expect(parsed.rungs).toHaveLength(1);
        });
        it('saveSourceModel 无源模型时静默跳过', () => {
            expect(() => storage.saveSourceModel(SaveModelAction.create())).not.toThrow();
        });
    });

    describe('LdCreateNodeHandler', () => {
        let handler: LdCreateNodeHandler;
        let state: MockModelState;
        beforeEach(() => {
            handler = new LdCreateNodeHandler();
            state = createMockState();
            injectState(handler, state);
        });
        it('创建 powerrail + contact 节点', () => {
            const graph = createLdGraph();
            state.set(LD_SOURCE_KEY, graph);
            handler.execute(CreateNodeOperation.create('node:powerrail', { x: 0, y: 0 }));
            handler.execute(CreateNodeOperation.create('node:contact', { location: { x: 120, y: 40 } }));
            const updated = state.get<LdGraph>(LD_SOURCE_KEY)!;
            expect(updated.nodes.some((n) => n.type === 'node:contact')).toBe(true);
            expect(updated.nodes.some((n) => n.type === 'node:powerrail')).toBe(true);
        });
        it('创建 NC contact 节点', () => {
            const graph = createLdGraph();
            state.set(LD_SOURCE_KEY, graph);
            handler.execute(CreateNodeOperation.create('node:contact', { location: { x: 120, y: 40 }, args: { contactType: 'NC' } }));
            const updated = state.get<LdGraph>(LD_SOURCE_KEY)!;
            const contact = updated.nodes.find((n) => n.type === 'node:contact') as any;
            expect(contact).toBeDefined();
            expect(contact.contactType).toBe('NC');
        });
        it('创建 coil 节点', () => {
            const graph = createLdGraph();
            const contact = createContact(ContactType.NO, 'X1', { x: 120, y: 40 });
            const rung = createRung(1, [contact.id]);
            graph.nodes.push(contact);
            graph.rungs.push(rung);
            state.set(LD_SOURCE_KEY, graph);
            handler.execute(CreateNodeOperation.create('node:coil', { location: { x: 480, y: 40 } }));
            const updated = state.get<LdGraph>(LD_SOURCE_KEY)!;
            expect(updated.nodes.some((n) => n.type === 'node:coil')).toBe(true);
        });
        it('coil 默认类型为 Normal', () => {
            const graph = createLdGraph();
            const contact = createContact(ContactType.NO, 'X1', { x: 120, y: 40 });
            const rung = createRung(1, [contact.id]);
            graph.nodes.push(contact);
            graph.rungs.push(rung);
            state.set(LD_SOURCE_KEY, graph);
            handler.execute(CreateNodeOperation.create('node:coil', { location: { x: 480, y: 40 } }));
            const updated = state.get<LdGraph>(LD_SOURCE_KEY)!;
            const coil = updated.nodes.find((n) => n.type === 'node:coil') as any;
            expect(coil).toBeDefined();
            expect(coil.coilType).toBe('Normal');
        });
    });

    describe('LdDeleteHandler', () => {
        let handler: LdDeleteHandler;
        let state: MockModelState;
        beforeEach(() => {
            handler = new LdDeleteHandler();
            state = createMockState();
            injectState(handler, state);
        });
        it('删除已存在的元素', () => {
            const contact = createContact(ContactType.NO, 'X1', { x: 120, y: 40 });
            const graph = createLdGraph();
            graph.nodes.push(contact);
            state.set(LD_SOURCE_KEY, graph);
            expect(countNodes(graph)).toBe(1);
            handler.execute(DeleteElementOperation.create([contact.id]));
            const updated = state.get<LdGraph>(LD_SOURCE_KEY)!;
            expect(countNodes(updated)).toBe(0);
        });
        it('删除不存在的元素时静默跳过', () => {
            const graph = createLdGraph();
            graph.nodes.push(createContact(ContactType.NO, 'X1', { x: 120, y: 40 }));
            state.set(LD_SOURCE_KEY, graph);
            expect(() => handler.execute(DeleteElementOperation.create(['nonexistent-id']))).not.toThrow();
            const updated = state.get<LdGraph>(LD_SOURCE_KEY)!;
            expect(countNodes(updated)).toBe(1);
        });
        it('删除元素时移除关联的边', () => {
            const contact = createContact(ContactType.NO, 'X1', { x: 120, y: 40 });
            const coil = createCoil(CoilType.Normal, 'Y1', { x: 480, y: 40 });
            const wire = createWire(contact.id, coil.id);
            const graph = createLdGraph();
            graph.nodes.push(contact, coil);
            graph.edges.push(wire);
            state.set(LD_SOURCE_KEY, graph);
            expect(countEdges(graph)).toBe(1);
            handler.execute(DeleteElementOperation.create([contact.id]));
            const updated = state.get<LdGraph>(LD_SOURCE_KEY)!;
            expect(updated.edges.find((e) => e.id === wire.id)).toBeUndefined();
        });
    });

    describe('LdChangeContactTypeHandler', () => {
        let handler: LdChangeContactTypeHandler;
        let state: MockModelState;
        beforeEach(() => {
            handler = new LdChangeContactTypeHandler();
            state = createMockState();
            injectState(handler, state);
        });
        it('将 contact 从 NO 改为 NC', () => {
            const contact = createContact(ContactType.NO, 'X1', { x: 120, y: 40 });
            const graph = createLdGraph();
            graph.nodes.push(contact);
            state.set(LD_SOURCE_KEY, graph);
            handler.execute(ChangeContactTypeOperation.create(contact.id, 'NC'));
            const updated = state.get<LdGraph>(LD_SOURCE_KEY)!;
            const c = updated.nodes.find((n) => n.id === contact.id) as any;
            expect(c.contactType).toBe('NC');
        });
        it('将 contact 从 NC 改为 NO', () => {
            const contact = createContact(ContactType.NC, 'X1', { x: 120, y: 40 });
            const graph = createLdGraph();
            graph.nodes.push(contact);
            state.set(LD_SOURCE_KEY, graph);
            handler.execute(ChangeContactTypeOperation.create(contact.id, 'NO'));
            const updated = state.get<LdGraph>(LD_SOURCE_KEY)!;
            const c = updated.nodes.find((n) => n.id === contact.id) as any;
            expect(c.contactType).toBe('NO');
        });
        it('对非 contact 元素静默跳过', () => {
            const coil = createCoil(CoilType.Normal, 'Y1', { x: 480, y: 40 });
            const graph = createLdGraph();
            graph.nodes.push(coil);
            state.set(LD_SOURCE_KEY, graph);
            expect(() => handler.execute(ChangeContactTypeOperation.create(coil.id, 'NC'))).not.toThrow();
            const updated = state.get<LdGraph>(LD_SOURCE_KEY)!;
            expect(updated.nodes).toHaveLength(1);
        });
        it('类型相同时幂等', () => {
            const contact = createContact(ContactType.NO, 'X1', { x: 120, y: 40 });
            const graph = createLdGraph();
            graph.nodes.push(contact);
            state.set(LD_SOURCE_KEY, graph);
            handler.execute(ChangeContactTypeOperation.create(contact.id, 'NO'));
            const updated = state.get<LdGraph>(LD_SOURCE_KEY)!;
            const c = updated.nodes.find((n) => n.id === contact.id) as any;
            expect(c.contactType).toBe('NO');
        });
    });

    describe('LdDiagramGenerator', () => {
        let generator: LdDiagramGenerator;
        let state: MockModelState;
        beforeEach(() => {
            generator = new LdDiagramGenerator();
            state = createMockState();
            injectState(generator, state);
        });
        it('无源模型时创建空 GGraph', () => {
            generator.createModel();
            const root = state.root;
            expect(root).toBeDefined();
            expect(root.type).toBe('graph');
            expect(root.id).toBe('ld-root');
            expect(countGModelNodes(root)).toBe(0);
        });
        it('从 LdGraph 生成 GGraph', () => {
            const contact = createContact(ContactType.NO, 'X1', { x: 120, y: 40 });
            const coil = createCoil(CoilType.Normal, 'Y1', { x: 480, y: 40 });
            const wire = createWire(contact.id, coil.id);
            const rung = createRung(1, [contact.id, coil.id]);
            const graph = createLdGraph();
            graph.nodes.push(contact, coil);
            graph.edges.push(wire);
            graph.rungs.push(rung);
            state.set(LD_SOURCE_KEY, graph);
            generator.createModel();
            const root = state.root;
            expect(root.type).toBe('graph');
            expect(root.id).toBe('ld-root');
            expect(countGModelNodes(root)).toBe(3);
            expect(countGModelEdges(root)).toBe(1);
        });
        it('contact 节点包含 CSS class', () => {
            const contact = createContact(ContactType.NC, 'X1', { x: 120, y: 40 });
            const graph = createLdGraph();
            graph.nodes.push(contact);
            state.set(LD_SOURCE_KEY, graph);
            generator.createModel();
            const root = state.root;
            const gnode = (root as any).children?.find((c: any) => c.type === 'node:contact');
            expect(gnode).toBeDefined();
            expect(gnode.cssClasses).toContain('contact-nc');
        });
    });
});
