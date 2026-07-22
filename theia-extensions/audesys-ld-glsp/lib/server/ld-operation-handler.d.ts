/**
 * LD Operation Handler — thin dispatch layer for Ladder Diagram GLSP operations.
 *
 * Each operation handler receives the current `LdGraph` state and operation
 * parameters, validates the request, and returns an updated `LdGraph` delta.
 *
 * This is a THIN server — validation + dispatch only. Complex layout logic
 * belongs to T2a.4 (Rust Layout Engine). The handlers call napi-rs
 * `compileLd` for compilation, with a fallback for testing.
 *
 * Ponytail: one class, one file. No per-operation handler classes —
 * they'd be single-method boilerplate. No inversify DI until GLSP
 * integration needs it.
 */
import { LdGraph } from '../gmodel/model';
import { ContactType, CoilType, PowerRailSide, Point } from '../gmodel/nodes';
import { ValidationResult } from '../gmodel/serialization';
export interface AddContactParams {
    position: Point;
    type: ContactType;
    rungId: string;
}
export interface AddCoilParams {
    position: Point;
    type: CoilType;
    rungId: string;
}
export interface DeleteElementParams {
    elementId: string;
}
export interface MoveElementParams {
    elementId: string;
    newPosition: Point;
}
export interface ConnectWireParams {
    sourceId: string;
    targetId: string;
    routingPoints?: Point[];
}
export interface DisconnectWireParams {
    edgeId: string;
}
export interface ChangeContactTypeParams {
    elementId: string;
    newType: ContactType;
}
export interface DeleteRungParams {
    rungId: string;
}
export interface MoveRungParams {
    rungId: string;
    newIndex: number;
}
export interface AddPowerRailParams {
    side: PowerRailSide;
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
    /** HalProgram JSON string on success, empty on failure */
    programJson: string;
    /** Diagnostics on failure, empty on success */
    diagnostics: CompileDiagnostic[];
}
type CompileFn = (source: string) => string;
export declare class LdOperationHandler {
    private compileFn;
    constructor(compileFn?: CompileFn);
    /**
     * Add a contact node to a rung.
     * Validates: position within rung area, not right of coil.
     * Auto-connects: wire from previous contact or left power rail.
     */
    addContact(graph: LdGraph, params: AddContactParams): LdGraph;
    /**
     * Add a coil node to a rung.
     * Validates: at most one coil per rung, position in coil area, contacts exist.
     */
    addCoil(graph: LdGraph, params: AddCoilParams): LdGraph;
    /**
     * Delete an element (contact, coil, or wire) and its connected edges.
     */
    deleteElement(graph: LdGraph, params: DeleteElementParams): LdGraph;
    /**
     * Move an element to a new position.
     */
    moveElement(graph: LdGraph, params: MoveElementParams): LdGraph;
    /**
     * Create a wire connection between two elements.
     * Validates: source and target exist, no direct power rail short.
     */
    connectWire(graph: LdGraph, params: ConnectWireParams): LdGraph;
    /**
     * Remove a wire connection.
     */
    disconnectWire(graph: LdGraph, params: DisconnectWireParams): LdGraph;
    /**
     * Change a contact's type (NO ↔ NC).
     */
    changeContactType(graph: LdGraph, params: ChangeContactTypeParams): LdGraph;
    /**
     * Add a new empty rung at the end of the diagram.
     */
    addRung(graph: LdGraph): LdGraph;
    /**
     * Delete a rung and all its elements.
     * Validates: at least one rung must remain after deletion.
     */
    deleteRung(graph: LdGraph, params: DeleteRungParams): LdGraph;
    /**
     * Reorder rungs by moving one to a new index.
     */
    moveRung(graph: LdGraph, params: MoveRungParams): LdGraph;
    /**
     * Add a power rail to the diagram.
     */
    addPowerRail(graph: LdGraph, params: AddPowerRailParams): LdGraph;
    /**
     * Validate the structural integrity of a ladder diagram.
     * Uses the existing `validateGraph` from gmodel/serialization,
     * plus additional LD-specific rules.
     */
    validate(graph: LdGraph): ValidationResult;
    /**
     * Compile the ladder diagram: GModel → LD text → napi-rs compileLd → HalProgram.
     *
     * Validates first, then compiles. Returns structured result with
     * diagnostics on failure.
     */
    compile(graph: LdGraph): CompileResult;
}
export {};
//# sourceMappingURL=ld-operation-handler.d.ts.map