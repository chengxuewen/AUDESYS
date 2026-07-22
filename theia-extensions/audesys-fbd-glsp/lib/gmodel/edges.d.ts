/**
 * FBD GModel — Edge type definitions for IEC 61131-3 Function Block Diagram.
 *
 * Edges represent the signal connections between FBD elements:
 * wires that carry Boolean/INT/REAL values from output pins to input pins.
 */
import { Point } from './nodes';
/**
 * Base graph edge — compatible with GLSP `GEdge`.
 *
 * Every connection in the graph model extends this interface.
 * The `type` discriminator uses GLSP's `edge:<kind>` convention.
 */
export interface BaseEdge {
    /** Unique identifier within the graph (UUID v4) */
    id: string;
    /** GLSP edge type discriminator, e.g. "edge:signal" */
    type: string;
    /** ID of the source node */
    sourceId: string;
    /** Name of the source pin on the source node */
    sourcePortName: string;
    /** ID of the target node */
    targetId: string;
    /** Name of the target pin on the target node */
    targetPortName: string;
    /** Optional CSS class names for styling */
    cssClasses?: string[];
}
/**
 * Signal edge connecting an output pin to an input pin.
 *
 * Represents a data flow wire between two FBD elements. The edge is
 * directional: it always flows from an output pin (source) to an input
 * pin (target). Routing points allow manual or auto-layout path control.
 *
 * In GLSP, this is an `edge:signal` element.
 */
export interface SignalEdge extends BaseEdge {
    type: 'edge:signal';
    /**
     * Manual routing waypoints for non-straight wire paths.
     * When undefined or empty, the wire is drawn as a straight line
     * between source and target (auto-routed by the layout engine).
     */
    routingPoints?: Point[];
}
/** Check if an edge is a SignalEdge. */
export declare function isSignalEdge(edge: BaseEdge): edge is SignalEdge;
//# sourceMappingURL=edges.d.ts.map