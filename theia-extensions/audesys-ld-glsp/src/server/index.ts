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
import { inject, injectable } from 'inversify';
import * as fs from 'fs';
import {
    Action,
    CreateNodeOperation,
    DeleteElementOperation,
    Operation,
    RequestModelAction,
    SaveModelAction,
    ShapeTypeHint,
    StatusAction,
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

import { LdGraph, createLdGraph } from '../gmodel/model';
import { ContactType, CoilType, PowerRailSide } from '../gmodel/nodes';
import { LdDiagramGenerator, LD_SOURCE_KEY } from './ld-diagram-generator';
import { LdOperationHandler } from './ld-operation-handler';
import { compileLdAsync, CompileResult } from './compile-bridge';
import { LdToolPaletteItemProvider } from './ld-tool-palette-provider';
import { LdGModelState } from './ld-gmodel-state';
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
    AddFbParams,
    CompileDiagnostic,
    CompileResult,
} from './ld-operation-handler';
export { LdGModelState } from './ld-gmodel-state';
export { LdDiagramGenerator, LD_SOURCE_KEY } from './ld-diagram-generator';

// ============================================================================
// Diagram Configuration
// ============================================================================

@injectable()
export class LdDiagramConfiguration implements DiagramConfiguration {
    readonly layoutKind = ServerLayoutKind.NONE;
    readonly needsClientLayout = true;
    readonly animatedUpdate = false;

    readonly shapeTypeHints: ShapeTypeHint[] = [
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
        {
            elementTypeId: 'node:fb',
            repositionable: true,
            deletable: true,
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
    ] as any;

    get typeMapping(): Map<string, GModelElementConstructor<GModelElement>> {
        return new Map();
    }
}

// ============================================================================
// Source Model Storage

// No-op handler for StatusAction — prevents GLSPServerError when
// reportModelLoading() dispatches StatusAction and no handler exists.
@injectable()
class StatusActionNoOpHandler implements ActionHandler {
    readonly actionKinds = [StatusAction.KIND];
    execute(_action: Action): Action[] {
        return [];
    }
}
// ============================================================================

@injectable()
export class LdSourceModelStorage implements SourceModelStorage {
    @inject(ModelState)
    protected modelState!: ModelState;

    loadSourceModel(action: RequestModelAction): void {
        console.error('[LD] loadSourceModel called, sourceUri:', action.options?.sourceUri);
        const existing = this.modelState.get<LdGraph>(LD_SOURCE_KEY);
        if (!existing) {
            // Try sourceUri first (file path from Theia GLSP integration)
            const sourceUri = action.options?.sourceUri;
            if (typeof sourceUri === 'string' && sourceUri) {
                try {
                    const filePath = sourceUri.replace('file://', '');
                    const content = fs.readFileSync(filePath, 'utf-8');
                    this.modelState.set(LD_SOURCE_KEY, JSON.parse(content) as LdGraph);
                    return;
                } catch (e) {
                }
            }
            // Try sourceModel (direct content injection)
            const sourceModel = action.options?.sourceModel;
            if (typeof sourceModel === 'string' && sourceModel) {
                this.modelState.set(LD_SOURCE_KEY, JSON.parse(sourceModel) as LdGraph);
            } else {
                this.modelState.set(LD_SOURCE_KEY, createLdGraph());
            }
        }
    }

    saveSourceModel(_action: SaveModelAction): void {
        const source = this.modelState.get<LdGraph>(LD_SOURCE_KEY);
        if (source) {
            this.modelState.set('ld-source-json', JSON.stringify(source, null, 2));
        }
    }
}

// ============================================================================
// Create Node Operation Handler
// ============================================================================

@injectable()
export class LdCreateNodeHandler extends OperationHandler {
    readonly operationType = CreateNodeOperation.KIND;
    override createCommand(_operation: Operation): Command | undefined { return undefined; }
    private handler = new LdOperationHandler();

    override execute(operation: Operation): any {
        const op = operation as CreateNodeOperation;
        let graph = this.modelState.get<LdGraph>(LD_SOURCE_KEY) ?? createLdGraph();
        const pos = op.location ?? { x: 0, y: 0 };
        const args = (op as any).args as Record<string, unknown> ?? {};
        let rungId: string | undefined;

        if (args.rungId && typeof args.rungId === 'string') {
            const found = graph.rungs.find((r) => r.id === args.rungId);
            if (!found) throw new Error(`Rung not found: ${args.rungId}`);
            rungId = args.rungId as string;
        } else {
            graph = this.handler.addRung(graph);
            rungId = graph.rungs[0].id;
        }

        switch (op.elementTypeId) {
            case 'node:contact': {
                const contactType: ContactType = (args.contactType as ContactType) || 'NO';
                graph = this.handler.addContact(graph, { position: pos, type: contactType, rungId: rungId! });
                break;
            }
            case 'node:coil': {
                const coilType: CoilType = (args.coilType as CoilType) || 'Normal';
                graph = this.handler.addCoil(graph, { position: pos, type: coilType, rungId: rungId! });
                break;
            }
            case 'node:powerrail': {
                graph = this.handler.addPowerRail(graph, { side: PowerRailSide.Left });
                graph = this.handler.addPowerRail(graph, { side: PowerRailSide.Right });
                break;
            }
            case 'node:fb': {
                const fbType = (args.fbType as string) || 'TON';
                graph = this.handler.addFb(graph, { position: pos, fbType, rungId: rungId! });
                break;
            }
            default:
                return;
        }

        this.modelState.set(LD_SOURCE_KEY, graph);
    }
}

// ============================================================================
// Delete Element Operation Handler
// ============================================================================

@injectable()
export class LdDeleteHandler extends OperationHandler {
    readonly operationType = DeleteElementOperation.KIND;
    override createCommand(_operation: Operation): Command | undefined { return undefined; }
    override handles(_operation: Operation): boolean { return true; }

    private handler = new LdOperationHandler();

    override execute(operation: Operation): any {
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
// Change Contact Type Operation — custom GLSP operation
// ============================================================================

export interface ChangeContactTypeOperation extends Operation {
    kind: typeof ChangeContactTypeOperation.KIND;
    elementId: string;
    newType: 'NO' | 'NC';
}
export namespace ChangeContactTypeOperation {
    export const KIND = 'changeContactType';
    export function is(object: unknown): object is ChangeContactTypeOperation {
        return Operation.is(object) && object.kind === KIND;
    }
    export function create(elementId: string, newType: 'NO' | 'NC'): ChangeContactTypeOperation {
        return { kind: KIND, elementId, newType, isOperation: true };
    }
}

@injectable()
export class LdChangeContactTypeHandler extends OperationHandler {
    override readonly operationType = ChangeContactTypeOperation.KIND;
    override readonly label = 'Change Contact Type';
    override createCommand(_operation: Operation): Command | undefined { return undefined; }
    override handles(_operation: Operation): boolean { return true; }

    private handler = new LdOperationHandler();

    override execute(operation: Operation): any {
        const op = operation as ChangeContactTypeOperation;
        let graph = this.modelState.get<LdGraph>(LD_SOURCE_KEY);
        if (!graph) return;
        try {
            graph = this.handler.changeContactType(graph, {
                elementId: op.elementId,
                newType: op.newType as ContactType,
            });
            this.modelState.set(LD_SOURCE_KEY, graph);
        } catch {
            // Element not found or not a contact — ignore
        }
    }
}

// ============================================================================
// Compile Action Handler — runs Rust compiler via worker_thread
// ============================================================================

@injectable()
export class LdCompileHandler extends OperationHandler {
    override readonly operationType = 'compileLd';
    override readonly label = 'Compile LD';
    override createCommand(_operation: Operation): Command | undefined { return undefined; }
    override handles(_operation: Operation): boolean { return true; }

    override async execute(operation: Operation): Promise<any> {
        const graph = this.modelState.get<LdGraph>(LD_SOURCE_KEY);
        if (!graph) return;
        const graphJson = JSON.stringify(graph);
        const result: CompileResult = await compileLdAsync(graphJson);
        this.modelState.set('ld-compile-result', result);
    }
}

// ============================================================================
// Diagram Module — wiring all services together
// ============================================================================

@injectable()
export class LdDiagramModule extends GModelDiagramModule {
    readonly diagramType = 'ld-diagram';

    protected override bindDiagramConfiguration(): BindingTarget<DiagramConfiguration> {
        return LdDiagramConfiguration;
    }

    protected override bindGModelFactory(): BindingTarget<GModelFactory> {
        return LdDiagramGenerator;
    }

    protected override bindSourceModelStorage(): BindingTarget<SourceModelStorage> {
        return LdSourceModelStorage;
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
        binding.add(LdCreateNodeHandler as unknown as OperationHandlerConstructor);
        binding.add(LdDeleteHandler as unknown as OperationHandlerConstructor);
        binding.add(LdChangeContactTypeHandler as unknown as OperationHandlerConstructor);
        binding.add(LdCompileHandler as unknown as OperationHandlerConstructor);
    }

    protected override bindToolPaletteItemProvider(): BindingTarget<ToolPaletteItemProvider> {
        return LdToolPaletteItemProvider;
    }
}

// Standalone launcher — GLSP 2.7.0 API
import { createAppModule, createSocketCliParser, SocketServerLauncher } from '@eclipse-glsp/server/node';
import { ServerModule } from '@eclipse-glsp/server';
import { Container } from 'inversify';

export async function launch(argv: string[] = process.argv): Promise<void> {
    const options = createSocketCliParser().parse(argv);
    const appContainer = new Container();
    appContainer.load(createAppModule(options));
    const launcher = appContainer.resolve(SocketServerLauncher);
    const serverModule = new ServerModule().configureDiagramModule(new LdDiagramModule());
    launcher.configure(serverModule);
    launcher.start({ port: options.port, host: options.host });
}
if (require.main === module) {
    launch().catch(error => console.error('LD GLSP server failed:', error));
}
