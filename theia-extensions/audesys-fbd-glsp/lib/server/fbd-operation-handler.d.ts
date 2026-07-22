/**
 * FBD Operation Handler — thin dispatch layer for Function Block Diagram GLSP operations.
 *
 * Ponytail: one class, one file. ~60% reused from LD pattern.
 */
import { FbdGraph } from '../gmodel/model';
import { GateType, Point } from '../gmodel/nodes';
import { ValidationResult } from '../gmodel/serialization';
export interface CreateGateParams {
    gateType: GateType;
    position: Point;
}
export interface CreateFunctionBlockParams {
    fbType: string;
    position: Point;
}
export interface DeleteElementParams {
    elementId: string;
}
export interface ConnectPinsParams {
    sourceNodeId: string;
    sourcePortName: string;
    targetNodeId: string;
    targetPortName: string;
}
export interface DisconnectPinParams {
    nodeId: string;
    portName: string;
}
export interface MoveElementParams {
    elementId: string;
    newPosition: Point;
}
export interface ChangeGateTypeParams {
    elementId: string;
    newGateType: GateType;
}
export interface ChangeFbTypeParams {
    fbId: string;
    newFbType: string;
}
export interface CompileDiagnostic {
    severity: 'error' | 'warning';
    elementId?: string;
    line?: number;
    message: string;
    code: string;
}
export interface CompileResult {
    success: boolean;
    programJson: string;
    diagnostics: CompileDiagnostic[];
}
type CompileFn = (source: string) => string;
export declare class FbdOperationHandler {
    private compileFn;
    constructor(compileFn?: CompileFn);
    /** Create a gate node with default pins. */
    createGate(graph: FbdGraph, params: CreateGateParams): FbdGraph;
    /** Create a function block with type-specific pins. */
    createFunctionBlock(graph: FbdGraph, params: CreateFunctionBlockParams): FbdGraph;
    /** Delete a node and all connected edges. */
    deleteElement(graph: FbdGraph, params: DeleteElementParams): FbdGraph;
    /** Connect output pin → input pin. Validates direction + type. */
    connectPins(graph: FbdGraph, params: ConnectPinsParams): FbdGraph;
    /** Disconnect all edges on a node's port. */
    disconnectPin(graph: FbdGraph, params: DisconnectPinParams): FbdGraph;
    /** Move node to new position (snap to grid). */
    moveElement(graph: FbdGraph, params: MoveElementParams): FbdGraph;
    /** Change gate type, regenerating pins. Preserves element ID. */
    changeGateType(graph: FbdGraph, params: ChangeGateTypeParams): FbdGraph;
    /** Change FB type, regenerating pins. Removes edges to obsolete pins. */
    changeFbType(graph: FbdGraph, params: ChangeFbTypeParams): FbdGraph;
    /** Validate: structural + unconnected output pin warnings. */
    validate(graph: FbdGraph): ValidationResult;
    /** Compile: validate → FBD→IL → napi-rs compileFbd → HalProgram. */
    compile(graph: FbdGraph): CompileResult;
}
export {};
//# sourceMappingURL=fbd-operation-handler.d.ts.map