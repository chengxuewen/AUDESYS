/**
 * FBD GLSP Server — GLSP 2.x integration layer for Function Block Diagram.
 *
 * Provides:
 *  - FbdDiagramModule       — DiagramModule subclass wiring all GLSP services
 *  - FbdDiagramConfiguration — type hints for nodes/edges/ports
 *  - FbdSourceModelStorage   — persistence for FbdGraph JSON
 *  - FbdDiagramGenerator     — FbdGraph → Sprotty GModel (see fbd-diagram-generator.ts)
 *  - FbdCreateNodeHandler    — handles createNode operations (gate, fb)
 *  - FbdDeleteHandler        — handles deleteElement operations
 *  - FbdConnectHandler       — handles createEdge operations (port-to-port)
 *  - FbdCompileHandler       — runs Rust compiler
 *
 * GLSP 2.x migration: imports from '@eclipse-glsp/server' (was server-node v1.x).
 */
import { inject, injectable } from 'inversify';
import {
    Action,
    CreateNodeOperation,
    CreateEdgeOperation,
    DeleteElementOperation,
    Operation,
    SaveModelAction,
    ShapeTypeHint,
    StatusAction,
    DefaultTypes,
} from '@eclipse-glsp/protocol';
import {
    ActionHandler,
    ActionHandlerConstructor,
    DiagramConfiguration,
    ServerLayoutKind,
    ModelState,
    GModelFactory,
    SourceModelStorage,
    OperationHandler,
    GModelDiagramModule,
    BindingTarget,
    InstanceMultiBinding,
    OperationHandlerConstructor,
    Command,
    ToolPaletteItemProvider,
} from '@eclipse-glsp/server';
import { ComputedBoundsActionHandler } from '@eclipse-glsp/server/node';
import { GModelElement, GModelElementConstructor } from '@eclipse-glsp/graph';

import { FbdGraph, createFbdGraph } from '../gmodel/model';
import { GateType } from '../gmodel/nodes';
import { FbdDiagramGenerator, FBD_SOURCE_KEY } from './fbd-diagram-generator';
import { FbdOperationHandler } from './fbd-operation-handler';
import { FbdToolPaletteItemProvider } from './fbd-tool-palette-provider';
import { FbdGModelState } from './fbd-gmodel-state';
import { convertGraphToIl } from './fbd-compile';

// ============================================================================
// Re-exports
// ============================================================================

export { FbdOperationHandler } from './fbd-operation-handler';
export type {
    CreateGateParams,
    CreateFunctionBlockParams,
    DeleteElementParams,
    ConnectPinsParams,
    DisconnectPinParams,
    MoveElementParams,
    ChangeGateTypeParams,
    ChangeFbTypeParams,
    CompileDiagnostic,
    CompileResult,
} from './fbd-operation-handler';
export { FbdGModelState } from './fbd-gmodel-state';
export { FbdDiagramGenerator, FBD_SOURCE_KEY } from './fbd-diagram-generator';

// ============================================================================
// Diagram Configuration
// ============================================================================

@injectable()
export class FbdDiagramConfiguration implements DiagramConfiguration {
    readonly layoutKind = ServerLayoutKind.NONE;
    readonly needsClientLayout = true;
    readonly animatedUpdate = false;

    readonly shapeTypeHints: ShapeTypeHint[] = [
        {
            elementTypeId: 'node:gate',
            repositionable: true,
            deletable: true,
            resizable: false,
            reparentable: false,
        },
        {
            elementTypeId: 'node:fb',
            repositionable: true,
            deletable: true,
            resizable: false,
            reparentable: false,
        },
        {
            elementTypeId: DefaultTypes.PORT,
            repositionable: false,
            deletable: false,
            resizable: false,
            reparentable: false,
        },
    ] as unknown as ShapeTypeHint[];

    readonly edgeTypeHints = [
        {
            elementTypeId: 'edge:signal',
            repositionable: false,
            deletable: true,
            routable: true,
            sourceElementTypeIds: [DefaultTypes.PORT],
            targetElementTypeIds: [DefaultTypes.PORT],
        },
    ] as any;

    get typeMapping(): Map<string, GModelElementConstructor<GModelElement>> {
        return new Map();
    }
}

// ============================================================================
// Source Model Storage
// ============================================================================

// No-op handler for StatusAction — prevents GLSPServerError when
// reportModelLoading() dispatches StatusAction and no handler exists.
@injectable()
class StatusActionNoOpHandler implements ActionHandler {
    readonly actionKinds = [StatusAction.KIND];
    execute(_action: Action): Action[] {
        return [];
    }
}

@injectable()
export class FbdSourceModelStorage implements SourceModelStorage {
    @inject(ModelState)
    protected modelState!: ModelState;

    loadSourceModel(action: { options?: { sourceUri?: unknown; sourceModel?: unknown } }): void {
        console.error('[FBD] loadSourceModel called, sourceUri:', action.options?.sourceUri);
        const existing = this.modelState.get<FbdGraph>(FBD_SOURCE_KEY);
        if (!existing) {
            // Try sourceUri first (file path from Theia GLSP integration)
            const sourceUri = action.options?.sourceUri;
            if (typeof sourceUri === 'string' && sourceUri) {
                try {
                    const fs = require('fs');
                    const filePath = sourceUri.replace('file://', '');
                    const content = fs.readFileSync(filePath, 'utf-8');
                    this.modelState.set(FBD_SOURCE_KEY, JSON.parse(content) as FbdGraph);
                    return;
                } catch (e) {
                    // File not found or invalid JSON — fall through
                }
            }
            // Try sourceModel (direct content injection)
            const sourceModel = action.options?.sourceModel;
            if (typeof sourceModel === 'string' && sourceModel) {
                this.modelState.set(FBD_SOURCE_KEY, JSON.parse(sourceModel) as FbdGraph);
            } else {
                this.modelState.set(FBD_SOURCE_KEY, createFbdGraph());
            }
        }
    }

    saveSourceModel(_action: SaveModelAction): void {
        const source = this.modelState.get<FbdGraph>(FBD_SOURCE_KEY);
        if (source) {
            this.modelState.set('fbd-source-json', JSON.stringify(source, null, 2));
        }
    }
}

// ============================================================================
// Create Node Operation Handler
// ============================================================================

@injectable()
export class FbdCreateNodeHandler extends OperationHandler {
    readonly operationType = CreateNodeOperation.KIND;
    override createCommand(_operation: Operation): Command | undefined { return undefined; }
    private handler = new FbdOperationHandler();

    override execute(operation: Operation): any {
        const op = operation as CreateNodeOperation;
        let graph = this.modelState.get<FbdGraph>(FBD_SOURCE_KEY) ?? createFbdGraph();
        const pos = op.location ?? { x: 0, y: 0 };
        const args = (op as any).args as Record<string, unknown> ?? {};

        switch (op.elementTypeId) {
            case 'node:gate': {
                const gateType: GateType = (args.gateType as GateType) || GateType.AND;
                graph = this.handler.createGate(graph, { gateType, position: pos });
                break;
            }
            case 'node:fb': {
                const fbType = (args.fbType as string) || 'TON';
                graph = this.handler.createFunctionBlock(graph, { fbType, position: pos });
                break;
            }
            default:
                return;
        }

        this.modelState.set(FBD_SOURCE_KEY, graph);
    }
}

// ============================================================================
// Delete Element Operation Handler
// ============================================================================

@injectable()
export class FbdDeleteHandler extends OperationHandler {
    readonly operationType = DeleteElementOperation.KIND;
    override createCommand(_operation: Operation): Command | undefined { return undefined; }
    override handles(_operation: Operation): boolean { return true; }

    private handler = new FbdOperationHandler();

    override execute(operation: Operation): any {
        const op = operation as DeleteElementOperation;
        let graph = this.modelState.get<FbdGraph>(FBD_SOURCE_KEY);
        if (!graph) return;

        for (const elementId of op.elementIds) {
            try {
                graph = this.handler.deleteElement(graph, { elementId });
            } catch {
                // Element already gone or invalid — skip
            }
        }

        this.modelState.set(FBD_SOURCE_KEY, graph);
    }
}

// ============================================================================
// Connect Edge Operation Handler (port-to-port)
// ============================================================================

/**
 * Parse port ID in format "nodeId::pinName".
 * Uses '::' separator to avoid ambiguity with node IDs that contain '-'.
 */
function parsePortId(portId: string): { nodeId: string; pinName: string } {
    const sep = portId.lastIndexOf('::');
    if (sep < 0) {
        throw new Error(`Invalid port ID format: ${portId} (expected "nodeId::pinName")`);
    }
    return {
        nodeId: portId.substring(0, sep),
        pinName: portId.substring(sep + 2),
    };
}

@injectable()
export class FbdConnectHandler extends OperationHandler {
    readonly operationType = CreateEdgeOperation.KIND;
    override createCommand(_operation: Operation): Command | undefined { return undefined; }
    override handles(_operation: Operation): boolean { return true; }

    private handler = new FbdOperationHandler();

    override execute(operation: Operation): any {
        const op = operation as CreateEdgeOperation;
        let graph = this.modelState.get<FbdGraph>(FBD_SOURCE_KEY);
        if (!graph) return;

        try {
            const source = parsePortId(op.sourceElementId);
            const target = parsePortId(op.targetElementId);

            // connectPins validates PinDirection and type compatibility internally
            graph = this.handler.connectPins(graph, {
                sourceNodeId: source.nodeId,
                sourcePortName: source.pinName,
                targetNodeId: target.nodeId,
                targetPortName: target.pinName,
            });
            this.modelState.set(FBD_SOURCE_KEY, graph);
        } catch (e) {
            console.error('[FBD] Connect failed:', e);
        }
    }
}

// ============================================================================
// Compile Action Handler
// ============================================================================

@injectable()
export class FbdCompileHandler extends OperationHandler {
    override readonly operationType = 'compileFbd';
    override readonly label = 'Compile FBD';
    override createCommand(_operation: Operation): Command | undefined { return undefined; }
    override handles(_operation: Operation): boolean { return true; }

    override async execute(_operation: Operation): Promise<any> {
        const graph = this.modelState.get<FbdGraph>(FBD_SOURCE_KEY);
        if (!graph) return;
        const result = convertGraphToIl(graph);
        this.modelState.set('fbd-compile-result', result);
    }
}

// ============================================================================
// Diagram Module — wiring all services together
// ============================================================================

@injectable()
export class FbdDiagramModule extends GModelDiagramModule {
    readonly diagramType = 'fbd-diagram';

    protected override bindDiagramConfiguration(): BindingTarget<DiagramConfiguration> {
        return FbdDiagramConfiguration;
    }

    protected override bindGModelFactory(): BindingTarget<GModelFactory> {
        return FbdDiagramGenerator;
    }

    protected override bindSourceModelStorage(): BindingTarget<SourceModelStorage> {
        return FbdSourceModelStorage;
    }

    protected override configureActionHandlers(
        binding: InstanceMultiBinding<ActionHandlerConstructor>,
    ): void {
        super.configureActionHandlers(binding);
        binding.add(StatusActionNoOpHandler as unknown as ActionHandlerConstructor);
        binding.add(ComputedBoundsActionHandler as unknown as ActionHandlerConstructor);
    }

    protected override configureOperationHandlers(
        binding: InstanceMultiBinding<OperationHandlerConstructor>,
    ): void {
        super.configureOperationHandlers(binding);
        binding.add(FbdCreateNodeHandler as unknown as OperationHandlerConstructor);
        binding.add(FbdDeleteHandler as unknown as OperationHandlerConstructor);
        binding.add(FbdConnectHandler as unknown as OperationHandlerConstructor);
        binding.add(FbdCompileHandler as unknown as OperationHandlerConstructor);
    }

    protected override bindToolPaletteItemProvider(): BindingTarget<ToolPaletteItemProvider> {
        return FbdToolPaletteItemProvider;
    }
}
