/**
 * FBD GModel — Graph model and factory functions for IEC 61131-3 Function Block Diagram.
 *
 * The `FbdGraph` is the root document model. It contains all nodes and
 * edges that together form a complete function block diagram. Unlike LD,
 * FBD has no rungs — it is a free-form directed graph of gates and function
 * blocks connected by signal wires.
 *
 * Factory functions provide a convenient API for creating fully-formed
 * model elements with sensible defaults.
 */
import { BaseNode, GateNode, GateType, FunctionBlockNode, Pin, Point } from './nodes';
import { BaseEdge, SignalEdge } from './edges';
/**
 * Root graph model for a function block diagram document.
 *
 * Contains all visual elements (gate nodes, function block nodes, signal edges).
 * This is the serializable unit that GLSP sends between server and client.
 *
 * In GLSP, this is a `graph:fbd` root element.
 */
export interface FbdGraph {
    /** Document identifier (UUID v4) — persisted with the diagram file */
    id: string;
    /** All nodes in the graph (gates, function blocks) */
    nodes: BaseNode[];
    /** All edges in the graph (signal wires) */
    edges: BaseEdge[];
}
/**
 * Generate a unique element ID.
 *
 * Uses a simple monotonic counter prefixed for readability.
 * In production, this would be replaced with UUID v4 generation.
 */
export declare function generateId(prefix: string): string;
/**
 * Reset the ID counter. Useful for deterministic tests.
 */
export declare function resetIdCounter(): void;
/**
 * Create an input pin with default position at left edge of the block.
 *
 * @param name - Pin identifier (e.g. "IN1", "EN")
 * @param dataType - IEC 61131-3 data type (e.g. "BOOL")
 * @param index - 0-based index among input pins (used for Y positioning)
 * @param totalPins - Total number of pins on this side (used for spacing)
 * @returns A fully-formed input Pin
 */
export declare function createInputPin(name: string, dataType: string, index: number, totalPins: number): Pin;
/**
 * Create an output pin with default position at right edge of the block.
 *
 * @param name - Pin identifier (e.g. "OUT", "ENO")
 * @param dataType - IEC 61131-3 data type (e.g. "BOOL")
 * @param blockWidth - Width of the parent block (used for X positioning)
 * @param index - 0-based index among output pins (used for Y positioning)
 * @param totalPins - Total number of pins on this side (used for spacing)
 * @returns A fully-formed output Pin
 */
export declare function createOutputPin(name: string, dataType: string, blockWidth: number, index: number, totalPins: number): Pin;
/**
 * Create a gate node with sensible defaults.
 *
 * Automatically generates the correct input/output pins based on gate type:
 * - AND/OR/XOR: 2 input pins, 1 output pin
 * - NOT: 1 input pin, 1 output pin
 * - MUX: SEL + 2 data input pins, 1 output pin
 *
 * @param gateType - Logic gate type (AND, OR, XOR, NOT, MUX)
 * @param position - Canvas position (defaults to origin)
 * @returns A fully-formed GateNode
 */
export declare function createGate(gateType: GateType, position?: Point): GateNode;
/**
 * Create a function block node.
 *
 * @param fbType - FB type name (e.g. "TON", "CTU", "ADD", "MOVE")
 * @param inputPins - Array of input pins
 * @param outputPins - Array of output pins
 * @param position - Canvas position (defaults to origin)
 * @returns A fully-formed FunctionBlockNode
 */
export declare function createFB(fbType: string, inputPins: Pin[], outputPins: Pin[], position?: Point): FunctionBlockNode;
/**
 * Create a signal edge between an output pin and an input pin.
 *
 * @param sourceId - ID of the source node
 * @param sourcePortName - Name of the output pin on the source node
 * @param targetId - ID of the target node
 * @param targetPortName - Name of the input pin on the target node
 * @param routingPoints - Optional manual routing waypoints
 * @returns A fully-formed SignalEdge
 */
export declare function createSignalEdge(sourceId: string, sourcePortName: string, targetId: string, targetPortName: string, routingPoints?: Point[]): SignalEdge;
/**
 * Create an empty function block diagram graph.
 *
 * @param id - Optional graph ID (auto-generated if omitted)
 * @returns An empty FbdGraph
 */
export declare function createFbdGraph(id?: string): FbdGraph;
//# sourceMappingURL=model.d.ts.map