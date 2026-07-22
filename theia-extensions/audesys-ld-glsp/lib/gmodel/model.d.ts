/**
 * LD GModel — Graph model and factory functions for IEC 61131-3 Ladder Diagram.
 *
 * The `LdGraph` is the root document model. It contains all nodes, edges,
 * and rungs that together form a complete ladder diagram.
 *
 * Factory functions provide a convenient API for creating fully-formed
 * model elements with sensible defaults.
 */
import { BaseNode, ContactNode, ContactType, CoilNode, CoilType, PowerRailNode, PowerRailSide, FbPlaceholderNode, Pin, Point } from './nodes';
import { BaseEdge, WireConnection, PowerConnection } from './edges';
/**
 * A single rung in the ladder diagram.
 *
 * Each rung represents one logical row of the ladder. It contains
 * a sequence of elements (contacts in series/parallel, optional
 * function blocks, and one or more coils) connected by wires between
 * the left and right power rails.
 *
 * Rungs are evaluated top-to-bottom, each in one scan cycle.
 */
export interface Rung {
    /** Unique identifier (UUID v4) */
    id: string;
    /** Sequential rung number starting from 1 (displayed as 001, 002, ...) */
    rungNumber: number;
    /** Optional user comment describing the rung's purpose */
    comment?: string;
    /** Ordered list of element IDs on this rung (left-to-right) */
    elementIds: string[];
}
/**
 * Root graph model for a ladder diagram document.
 *
 * Contains all visual elements (nodes, edges) and the logical
 * rung structure. This is the serializable unit that GLSP sends
 * between server and client.
 *
 * In GLSP, this is a `graph:ld` root element.
 */
export interface LdGraph {
    /** Document identifier (UUID v4) — persisted with the diagram file */
    id: string;
    /** All nodes in the graph (contacts, coils, rails, FB placeholders) */
    nodes: BaseNode[];
    /** All edges in the graph (wires, power connections) */
    edges: BaseEdge[];
    /** Rungs defining the logical structure, evaluated top-to-bottom */
    rungs: Rung[];
}
/**
 * Generate a unique element ID.
 *
 * Uses a simple monotonic counter prefixed for readability.
 * In production, this would be replaced with UUID v4 generation.
 */
export declare function generateId(prefix: string): string;
/**
 * Create a contact node with sensible defaults.
 *
 * @param contactType - NO (normally open) or NC (normally closed)
 * @param variableName - IEC 61131-3 variable name, e.g. "X1"
 * @param position - Canvas position (defaults to origin)
 * @returns A fully-formed ContactNode
 */
export declare function createContact(contactType: ContactType, variableName: string, position?: Point): ContactNode;
/**
 * Create a coil node with sensible defaults.
 *
 * @param coilType - Normal, Negated, Set, or Reset
 * @param variableName - IEC 61131-3 variable name, e.g. "Y1"
 * @param position - Canvas position (defaults to origin)
 * @returns A fully-formed CoilNode
 */
export declare function createCoil(coilType: CoilType, variableName: string, position?: Point): CoilNode;
/**
 * Create a power rail node.
 *
 * @param side - Left or Right power rail
 * @param position - Canvas position (defaults to origin)
 * @param height - Rail height in abstract units (matches total diagram height)
 * @returns A fully-formed PowerRailNode
 */
export declare function createPowerRail(side: PowerRailSide, position?: Point, height?: number): PowerRailNode;
/**
 * Create a function block placeholder node.
 *
 * @param fbType - FB type name (e.g. "TON", "CTU", "ADD")
 * @param inputPins - Array of input pins (must include "EN")
 * @param outputPins - Array of output pins (must include "ENO")
 * @param position - Canvas position (defaults to origin)
 * @returns A fully-formed FbPlaceholderNode
 */
export declare function createFb(fbType: string, inputPins: Pin[], outputPins: Pin[], position?: Point): FbPlaceholderNode;
/**
 * Create a wire connection between two elements.
 *
 * @param sourceId - ID of the source node (left element)
 * @param targetId - ID of the target node (right element)
 * @param routingPoints - Optional manual routing waypoints
 * @returns A fully-formed WireConnection
 */
export declare function createWire(sourceId: string, targetId: string, routingPoints?: Point[]): WireConnection;
/**
 * Create a power connection from a power rail to a rung element.
 *
 * @param sourceId - ID of the power rail node
 * @param targetId - ID of the target element
 * @returns A fully-formed PowerConnection
 */
export declare function createPowerConnection(sourceId: string, targetId: string): PowerConnection;
/**
 * Create a rung structure for the ladder diagram.
 *
 * @param rungNumber - Sequential rung number (1-based)
 * @param elementIds - Ordered list of element IDs on this rung
 * @param comment - Optional rung comment
 * @returns A fully-formed Rung
 */
export declare function createRung(rungNumber: number, elementIds: string[], comment?: string): Rung;
/**
 * Create an empty ladder diagram graph.
 *
 * Includes default left and right power rails.
 *
 * @param id - Optional graph ID (auto-generated if omitted)
 * @returns An empty LdGraph with power rails
 */
export declare function createLdGraph(id?: string): LdGraph;
//# sourceMappingURL=model.d.ts.map