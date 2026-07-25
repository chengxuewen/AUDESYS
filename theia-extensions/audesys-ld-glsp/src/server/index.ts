/**
 * LD GLSP Server — GLSP integration layer.
 *
 * Provides:
 *  - LdDiagramModule       — inversify DI module wiring all GLSP services
 *  - LdDiagramConfiguration — type hints for nodes/edges
 *  - LdSourceModelStorage   — persistence for LdGraph JSON
 *  - LdDiagramGenerator     — LdGraph → Sprotty GModel (see ld-diagram-generator.ts)
 *  - LdCreateNodeHandler    — handles createNode operations (contact, coil)
 *  - LdDeleteHandler        — handles deleteElement operations
 *
 * Also re-exports LD-specific types (operation params, operation handler, etc.).
 *
 * Ponytail: one file for the GLSP module + config + handlers. No exploded
 * per-class files for what are essentially thin wrappers.
 */

import { inject, injectable } from 'inversify';
import {
    CreateNodeOperation,
    DeleteElementOperation,
    Operation,
    RequestModelAction,
    SaveModelAction,
    ShapeTypeHint,
} from '@eclipse-glsp/protocol';
import {
    DiagramConfiguration,
    ServerLayoutKind,
    ModelState,
    GModelFactory,
    SourceModelStorage,
    OperationHandler,
    GModelDiagramModule,
    SocketServerLauncher,
} from '@eclipse-glsp/server-node';
import { BindingTarget } from '@eclipse-glsp/server-node/lib/di/binding-target';
import { InstanceMultiBinding } from '@eclipse-glsp/server-node/lib/di/multi-binding';
import { OperationHandlerConstructor } from '@eclipse-glsp/server-node/lib/operations/operation-handler';

import { LdGraph, createLdGraph } from '../gmodel/model';
import { ContactType, CoilType, PowerRailSide } from '../gmodel/nodes';
import { LdDiagramGenerator, LD_SOURCE_KEY } from './ld-diagram-generator';
import { LdOperationHandler } from './ld-operation-handler';

// ============================================================================
// Re-exports
// ============================================================================

export { LdOperationHandler } from './ld-operation-handler';
export type {
    AddContactParams,
    AddCoilParams,
    DeleteElementParams,
    MoveElementParams,
    ConnectWireParams,
    DisconnectWireParams,
    ChangeContactTypeParams,
    DeleteRungParams,
    MoveRungParams,
    AddPowerRailParams,
    CompileDiagnostic,
    CompileResult,
} from './ld-operation-handler';
export { LdGModelState } from './ld-gmodel-state';
export { LdDiagramGenerator, LD_SOURCE_KEY } from './ld-diagram-generator';

// ============================================================================
// Diagram Configuration — tells client what node/edge types are supported
// ============================================================================

// ponytail: EdgeTypeHint has version mismatch between @eclipse-glsp/protocol
// and @eclipse-glsp/graph's nested copy. Cast to any to work around.
// Same shape at runtime, compile-time types differ on optional fields.

@injectable()
export class LdDiagramConfiguration implements DiagramConfiguration {
    readonly layoutKind = ServerLayoutKind.NONE;
    readonly needsClientLayout = true;
    readonly animatedUpdate = false;

    readonly shapeTypeHints = [
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
    ] as unknown as ShapeTypeHint[];

    readonly edgeTypeHints = [
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
    ] as any; // ponytail: cross-package type mismatch, identical at runtime

    readonly typeMapping = new Map<string, any>([
        ['graph', 'GGraph'],
        ['node:contact', 'GNode'],
        ['node:coil', 'GNode'],
        ['node:powerrail', 'GNode'],
        ['node:fb', 'GNode'],
        ['rung:group', 'GNode'],
        ['edge:wire', 'GEdge'],
        ['label:name', 'GLabel'],
    ]);

}

// ============================================================================
// Source Model Storage — persists LdGraph as JSON
// ============================================================================

@injectable()
export class LdSourceModelStorage implements SourceModelStorage {
    @inject(ModelState)
    protected modelState!: ModelState;

    loadSourceModel(_action: RequestModelAction): void {
        // ponytail: start with a default empty graph.
        // Load from file will be wired when the Studio file system integration is ready.
        const existing = this.modelState.get<LdGraph>(LD_SOURCE_KEY);
        if (!existing) {
            this.modelState.set(LD_SOURCE_KEY, createLdGraph());
        }
    }

    saveSourceModel(_action: SaveModelAction): void {
        // ponytail: save to ModelState only. File persistence is handled by
        // the Studio file system integration later.
        const source = this.modelState.get<LdGraph>(LD_SOURCE_KEY);
        if (source) {
            this.modelState.set('ld-source-json', JSON.stringify(source, null, 2));
        }
    }
}

// ============================================================================
// Create Node Operation Handler — maps GLSP createNode to LdOperationHandler
// ============================================================================

@injectable()
export class LdCreateNodeHandler implements OperationHandler {
    readonly operationType = CreateNodeOperation.KIND;
    readonly label = 'Create LD Element';

    @inject(ModelState)
    protected modelState!: ModelState;

    private handler = new LdOperationHandler();

    execute(operation: Operation): void {
        const op = operation as CreateNodeOperation;
        let graph = this.modelState.get<LdGraph>(LD_SOURCE_KEY) ?? createLdGraph();
        const pos = op.location ?? { x: 0, y: 0 };
        const args = (op as Record<string, unknown>).args as Record<string, unknown> ?? {};
        const rungId = (args.rungId as string) || this.ensureRung(graph);

        switch (op.elementTypeId) {
            case 'node:contact': {
                const contactType: ContactType = (args.contactType as ContactType) || 'NO';
                graph = this.handler.addContact(graph, {
                    position: pos,
                    type: contactType,
                    rungId,
                });
                break;
            }
            case 'node:coil': {
                const coilType: CoilType = (args.coilType as CoilType) || 'OUT';
                graph = this.handler.addCoil(graph, {
                    position: pos,
                    type: coilType,
                    rungId,
                });
                break;
            }
            case 'node:powerrail': {
                graph = this.handler.addPowerRail(graph, { side: PowerRailSide.Left });
                graph = this.handler.addPowerRail(graph, { side: PowerRailSide.Right });
                break;
            }
            default:
                // Unknown element type — ignore silently
                return;
        }

        this.modelState.set(LD_SOURCE_KEY, graph);
    }

    /** Ensure at least one rung exists, return its ID. */
    private ensureRung(graph: LdGraph): string {
        if (graph.rungs.length > 0) {
            return graph.rungs[0].id;
        }
        return this.handler.addRung(graph).rungs[graph.rungs.length - 1].id;
    }
}

// ============================================================================
// Delete Element Operation Handler
// ============================================================================

@injectable()
export class LdDeleteHandler implements OperationHandler {
    readonly operationType = DeleteElementOperation.KIND;
    readonly label = 'Delete LD Element';

    @inject(ModelState)
    protected modelState!: ModelState;

    private handler = new LdOperationHandler();

    execute(operation: Operation): void {
        const op = operation as DeleteElementOperation;
        let graph = this.modelState.get<LdGraph>(LD_SOURCE_KEY);
        if (!graph) return;

        for (const elementId of op.elementIds) {
            try {
                graph = this.handler.deleteElement(graph, { elementId });
            } catch {
                // Element already gone or invalid — skip
            }
        }

        this.modelState.set(LD_SOURCE_KEY, graph);
    }
}

// ============================================================================
// Diagram Module — wiring all services together
// ============================================================================

/**
 * Inversify DI module for the LD GLSP diagram.
 *
 * Extends GModelDiagramModule with LD-specific bindings:
 *  - DiagramConfiguration → LdDiagramConfiguration
 *  - GModelFactory       → LdDiagramGenerator
 *  - SourceModelStorage  → LdSourceModelStorage
 *  - OperationHandlers   → LdCreateNodeHandler, LdDeleteHandler
 */
@injectable()
export class LdDiagramModule extends GModelDiagramModule {
    readonly diagramType = 'ld-diagram';

    protected override bindDiagramConfiguration(): BindingTarget<DiagramConfiguration> {
        return LdDiagramConfiguration as any; // ponytail: cross-package type mismatch
    }

    protected override bindGModelFactory(): BindingTarget<GModelFactory> {
        return LdDiagramGenerator;
    }

    protected override bindSourceModelStorage(): BindingTarget<SourceModelStorage> {
        return LdSourceModelStorage;
    }

    protected override configureOperationHandlers(
        binding: InstanceMultiBinding<OperationHandlerConstructor>,
    ): void {
        super.configureOperationHandlers(binding);
        binding.add(LdCreateNodeHandler as unknown as OperationHandlerConstructor);
        binding.add(LdDeleteHandler as unknown as OperationHandlerConstructor);
    }
}

// ============================================================================
// GLSP Server Launcher — JSON-RPC over WebSocket (socket connection)
// ============================================================================

/**
 * Launch a standalone LD GLSP server via TCP socket.
 *
 * Usage (standalone): `node lib/server/index.js` or call `launchLdServer(port)`.
 */
export function launchLdServer(port: number = 5007): void {
    const launcher = new SocketServerLauncher();
    launcher.run({ port }).catch((err: unknown) => {
        console.error('LD GLSP server failed:', err);
        process.exit(1);
    });
}
