import { Operation, RequestModelAction, SaveModelAction, ShapeTypeHint } from '@eclipse-glsp/protocol';
import { DiagramConfiguration, ServerLayoutKind, ModelState, GModelFactory, SourceModelStorage, OperationHandler, GModelDiagramModule, BindingTarget, InstanceMultiBinding, OperationHandlerConstructor, GModelElement, GModelElementConstructor, Command } from '@eclipse-glsp/server';
export { LdOperationHandler } from './ld-operation-handler';
export type { AddContactParams, AddCoilParams, DeleteElementParams, MoveElementParams, ConnectWireParams, DisconnectWireParams, ChangeContactTypeParams, DeleteRungParams, MoveRungParams, AddPowerRailParams, CompileDiagnostic, CompileResult, } from './ld-operation-handler';
export { LdGModelState } from './ld-gmodel-state';
export { LdDiagramGenerator, LD_SOURCE_KEY } from './ld-diagram-generator';
export declare class LdDiagramConfiguration implements DiagramConfiguration {
    readonly layoutKind = ServerLayoutKind.NONE;
    readonly needsClientLayout = true;
    readonly animatedUpdate = false;
    readonly shapeTypeHints: ShapeTypeHint[];
    readonly edgeTypeHints: any;
    get typeMapping(): Map<string, GModelElementConstructor<GModelElement>>;
}
export declare class LdSourceModelStorage implements SourceModelStorage {
    protected modelState: ModelState;
    loadSourceModel(_action: RequestModelAction): void;
    saveSourceModel(_action: SaveModelAction): void;
}
export declare class LdCreateNodeHandler extends OperationHandler {
    readonly operationType = "createNode";
    createCommand(_operation: Operation): Command | undefined;
    handles(_operation: Operation): boolean;
    private handler;
    execute(operation: Operation): any;
}
export declare class LdDeleteHandler extends OperationHandler {
    readonly operationType = "deleteElement";
    createCommand(_operation: Operation): Command | undefined;
    handles(_operation: Operation): boolean;
    private handler;
    execute(operation: Operation): any;
}
export interface ChangeContactTypeOperation extends Operation {
    kind: typeof ChangeContactTypeOperation.KIND;
    elementId: string;
    newType: 'NO' | 'NC';
}
export declare namespace ChangeContactTypeOperation {
    const KIND = "changeContactType";
    function is(object: unknown): object is ChangeContactTypeOperation;
    function create(elementId: string, newType: 'NO' | 'NC'): ChangeContactTypeOperation;
}
export declare class LdChangeContactTypeHandler extends OperationHandler {
    readonly operationType = "changeContactType";
    readonly label = "Change Contact Type";
    createCommand(_operation: Operation): Command | undefined;
    handles(_operation: Operation): boolean;
    private handler;
    execute(operation: Operation): any;
}
export declare class LdCompileHandler extends OperationHandler {
    readonly operationType = "compileLd";
    readonly label = "Compile LD";
    createCommand(_operation: Operation): Command | undefined;
    handles(_operation: Operation): boolean;
    execute(operation: Operation): Promise<any>;
}
export declare class LdDiagramModule extends GModelDiagramModule {
    readonly diagramType = "ld-diagram";
    protected bindDiagramConfiguration(): BindingTarget<DiagramConfiguration>;
    protected bindGModelFactory(): BindingTarget<GModelFactory>;
    protected bindSourceModelStorage(): BindingTarget<SourceModelStorage>;
    protected configureOperationHandlers(binding: InstanceMultiBinding<OperationHandlerConstructor>): void;
}
//# sourceMappingURL=index.d.ts.map