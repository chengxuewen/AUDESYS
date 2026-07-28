"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LdDiagramModule = exports.LdCompileHandler = exports.LdChangeContactTypeHandler = exports.ChangeContactTypeOperation = exports.LdDeleteHandler = exports.LdCreateNodeHandler = exports.LdSourceModelStorage = exports.LdDiagramConfiguration = exports.LD_SOURCE_KEY = exports.LdDiagramGenerator = exports.LdGModelState = exports.LdOperationHandler = void 0;
/**
 * LD GLSP Server — GLSP 2.x integration layer.
 *
 * Provides:
 *  - LdDiagramModule       — DiagramModule subclass wiring all GLSP services
 *  - LdDiagramConfiguration — type hints for nodes/edges
 *  - LdSourceModelStorage   — persistence for LdGraph JSON
 *  - LdDiagramGenerator     — LdGraph → Sprotty GModel (see ld-diagram-generator.ts)
 *  - LdCreateNodeHandler    — handles createNode operations (contact, coil)
 *  - LdDeleteHandler        — handles deleteElement operations
 *  - LdChangeContactTypeHandler — handles changeContactType operations
 *  - LdCompileHandler       — runs Rust compiler via worker_thread
 *
 * GLSP 2.x migration: imports from '@eclipse-glsp/server' (was server-node v1.x).
 */
const inversify_1 = require("inversify");
const protocol_1 = require("@eclipse-glsp/protocol");
const server_1 = require("@eclipse-glsp/server");
const model_1 = require("../gmodel/model");
const nodes_1 = require("../gmodel/nodes");
const ld_diagram_generator_1 = require("./ld-diagram-generator");
const ld_operation_handler_1 = require("./ld-operation-handler");
const compile_bridge_1 = require("./compile-bridge");
// ============================================================================
// Re-exports
// ============================================================================
var ld_operation_handler_2 = require("./ld-operation-handler");
Object.defineProperty(exports, "LdOperationHandler", { enumerable: true, get: function () { return ld_operation_handler_2.LdOperationHandler; } });
var ld_gmodel_state_1 = require("./ld-gmodel-state");
Object.defineProperty(exports, "LdGModelState", { enumerable: true, get: function () { return ld_gmodel_state_1.LdGModelState; } });
var ld_diagram_generator_2 = require("./ld-diagram-generator");
Object.defineProperty(exports, "LdDiagramGenerator", { enumerable: true, get: function () { return ld_diagram_generator_2.LdDiagramGenerator; } });
Object.defineProperty(exports, "LD_SOURCE_KEY", { enumerable: true, get: function () { return ld_diagram_generator_2.LD_SOURCE_KEY; } });
// ============================================================================
// Diagram Configuration
// ============================================================================
let LdDiagramConfiguration = class LdDiagramConfiguration {
    constructor() {
        this.layoutKind = server_1.ServerLayoutKind.NONE;
        this.needsClientLayout = true;
        this.animatedUpdate = false;
        this.shapeTypeHints = [
            {
                elementTypeId: 'node:contact',
                repositionable: true,
                deletable: true,
                resizable: false,
                reparentable: false,
            },
            {
                elementTypeId: 'node:coil',
                repositionable: true,
                deletable: true,
                resizable: false,
                reparentable: false,
            },
            {
                elementTypeId: 'node:powerrail',
                repositionable: false,
                deletable: false,
                resizable: false,
                reparentable: false,
            },
        ];
        this.edgeTypeHints = [
            {
                elementTypeId: 'edge:wire',
                repositionable: false,
                deletable: true,
                routable: true,
                sourceElementTypeIds: [
                    'node:contact', 'node:coil', 'node:powerrail', 'node:fb',
                ],
                targetElementTypeIds: [
                    'node:contact', 'node:coil', 'node:powerrail', 'node:fb',
                ],
            },
        ];
    }
    get typeMapping() {
        return (0, server_1.getDefaultMapping)();
    }
};
exports.LdDiagramConfiguration = LdDiagramConfiguration;
exports.LdDiagramConfiguration = LdDiagramConfiguration = __decorate([
    (0, inversify_1.injectable)()
], LdDiagramConfiguration);
// ============================================================================
// Source Model Storage
// ============================================================================
let LdSourceModelStorage = class LdSourceModelStorage {
    loadSourceModel(_action) {
        const existing = this.modelState.get(ld_diagram_generator_1.LD_SOURCE_KEY);
        if (!existing) {
            this.modelState.set(ld_diagram_generator_1.LD_SOURCE_KEY, (0, model_1.createLdGraph)());
        }
    }
    saveSourceModel(_action) {
        const source = this.modelState.get(ld_diagram_generator_1.LD_SOURCE_KEY);
        if (source) {
            this.modelState.set('ld-source-json', JSON.stringify(source, null, 2));
        }
    }
};
exports.LdSourceModelStorage = LdSourceModelStorage;
__decorate([
    (0, inversify_1.inject)(server_1.ModelState),
    __metadata("design:type", Object)
], LdSourceModelStorage.prototype, "modelState", void 0);
exports.LdSourceModelStorage = LdSourceModelStorage = __decorate([
    (0, inversify_1.injectable)()
], LdSourceModelStorage);
// ============================================================================
// Create Node Operation Handler
// ============================================================================
let LdCreateNodeHandler = class LdCreateNodeHandler extends server_1.OperationHandler {
    constructor() {
        super(...arguments);
        this.operationType = protocol_1.CreateNodeOperation.KIND;
        this.handler = new ld_operation_handler_1.LdOperationHandler();
    }
    createCommand(_operation) { return undefined; }
    handles(_operation) { return true; }
    execute(operation) {
        const op = operation;
        let graph = this.modelState.get(ld_diagram_generator_1.LD_SOURCE_KEY) ?? (0, model_1.createLdGraph)();
        const pos = op.location ?? { x: 0, y: 0 };
        const args = op.args ?? {};
        let rungId;
        if (args.rungId && typeof args.rungId === 'string') {
            const found = graph.rungs.find((r) => r.id === args.rungId);
            if (!found)
                throw new Error(`Rung not found: ${args.rungId}`);
            rungId = args.rungId;
        }
        else {
            graph = this.handler.addRung(graph);
            rungId = graph.rungs[0].id;
        }
        switch (op.elementTypeId) {
            case 'node:contact': {
                const contactType = args.contactType || 'NO';
                graph = this.handler.addContact(graph, { position: pos, type: contactType, rungId: rungId });
                break;
            }
            case 'node:coil': {
                const coilType = args.coilType || 'Normal';
                graph = this.handler.addCoil(graph, { position: pos, type: coilType, rungId: rungId });
                break;
            }
            case 'node:powerrail': {
                graph = this.handler.addPowerRail(graph, { side: nodes_1.PowerRailSide.Left });
                graph = this.handler.addPowerRail(graph, { side: nodes_1.PowerRailSide.Right });
                break;
            }
            default:
                return;
        }
        this.modelState.set(ld_diagram_generator_1.LD_SOURCE_KEY, graph);
    }
};
exports.LdCreateNodeHandler = LdCreateNodeHandler;
exports.LdCreateNodeHandler = LdCreateNodeHandler = __decorate([
    (0, inversify_1.injectable)()
], LdCreateNodeHandler);
// ============================================================================
// Delete Element Operation Handler
// ============================================================================
let LdDeleteHandler = class LdDeleteHandler extends server_1.OperationHandler {
    constructor() {
        super(...arguments);
        this.operationType = protocol_1.DeleteElementOperation.KIND;
        this.handler = new ld_operation_handler_1.LdOperationHandler();
    }
    createCommand(_operation) { return undefined; }
    handles(_operation) { return true; }
    execute(operation) {
        const op = operation;
        let graph = this.modelState.get(ld_diagram_generator_1.LD_SOURCE_KEY);
        if (!graph)
            return;
        for (const elementId of op.elementIds) {
            try {
                graph = this.handler.deleteElement(graph, { elementId });
            }
            catch {
                // Element already gone or invalid — skip
            }
        }
        this.modelState.set(ld_diagram_generator_1.LD_SOURCE_KEY, graph);
    }
};
exports.LdDeleteHandler = LdDeleteHandler;
exports.LdDeleteHandler = LdDeleteHandler = __decorate([
    (0, inversify_1.injectable)()
], LdDeleteHandler);
var ChangeContactTypeOperation;
(function (ChangeContactTypeOperation) {
    ChangeContactTypeOperation.KIND = 'changeContactType';
    function is(object) {
        return protocol_1.Operation.is(object) && object.kind === ChangeContactTypeOperation.KIND;
    }
    ChangeContactTypeOperation.is = is;
    function create(elementId, newType) {
        return { kind: ChangeContactTypeOperation.KIND, elementId, newType, isOperation: true };
    }
    ChangeContactTypeOperation.create = create;
})(ChangeContactTypeOperation || (exports.ChangeContactTypeOperation = ChangeContactTypeOperation = {}));
let LdChangeContactTypeHandler = class LdChangeContactTypeHandler extends server_1.OperationHandler {
    constructor() {
        super(...arguments);
        this.operationType = ChangeContactTypeOperation.KIND;
        this.label = 'Change Contact Type';
        this.handler = new ld_operation_handler_1.LdOperationHandler();
    }
    createCommand(_operation) { return undefined; }
    handles(_operation) { return true; }
    execute(operation) {
        const op = operation;
        let graph = this.modelState.get(ld_diagram_generator_1.LD_SOURCE_KEY);
        if (!graph)
            return;
        try {
            graph = this.handler.changeContactType(graph, {
                elementId: op.elementId,
                newType: op.newType,
            });
            this.modelState.set(ld_diagram_generator_1.LD_SOURCE_KEY, graph);
        }
        catch {
            // Element not found or not a contact — ignore
        }
    }
};
exports.LdChangeContactTypeHandler = LdChangeContactTypeHandler;
exports.LdChangeContactTypeHandler = LdChangeContactTypeHandler = __decorate([
    (0, inversify_1.injectable)()
], LdChangeContactTypeHandler);
// ============================================================================
// Compile Action Handler — runs Rust compiler via worker_thread
// ============================================================================
let LdCompileHandler = class LdCompileHandler extends server_1.OperationHandler {
    constructor() {
        super(...arguments);
        this.operationType = 'compileLd';
        this.label = 'Compile LD';
    }
    createCommand(_operation) { return undefined; }
    handles(_operation) { return true; }
    async execute(operation) {
        const graph = this.modelState.get(ld_diagram_generator_1.LD_SOURCE_KEY);
        if (!graph)
            return;
        const graphJson = JSON.stringify(graph);
        const result = await (0, compile_bridge_1.compileLdAsync)(graphJson);
        this.modelState.set('ld-compile-result', result);
    }
};
exports.LdCompileHandler = LdCompileHandler;
exports.LdCompileHandler = LdCompileHandler = __decorate([
    (0, inversify_1.injectable)()
], LdCompileHandler);
// ============================================================================
// Diagram Module — wiring all services together
// ============================================================================
let LdDiagramModule = class LdDiagramModule extends server_1.GModelDiagramModule {
    constructor() {
        super(...arguments);
        this.diagramType = 'ld-diagram';
    }
    bindDiagramConfiguration() {
        return LdDiagramConfiguration;
    }
    bindGModelFactory() {
        return ld_diagram_generator_1.LdDiagramGenerator;
    }
    bindSourceModelStorage() {
        return LdSourceModelStorage;
    }
    configureOperationHandlers(binding) {
        super.configureOperationHandlers(binding);
        binding.add(LdCreateNodeHandler);
        binding.add(LdDeleteHandler);
        binding.add(LdChangeContactTypeHandler);
        binding.add(LdCompileHandler);
    }
};
exports.LdDiagramModule = LdDiagramModule;
exports.LdDiagramModule = LdDiagramModule = __decorate([
    (0, inversify_1.injectable)()
], LdDiagramModule);
//# sourceMappingURL=index.js.map