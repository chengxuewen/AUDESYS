"use strict";
/**
 * FBD GModel — Edge type definitions for IEC 61131-3 Function Block Diagram.
 *
 * Edges represent the signal connections between FBD elements:
 * wires that carry Boolean/INT/REAL values from output pins to input pins.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSignalEdge = isSignalEdge;
// ============================================================================
// Type Guard Helpers
// ============================================================================
/** Check if an edge is a SignalEdge. */
function isSignalEdge(edge) {
    return edge.type === 'edge:signal';
}
//# sourceMappingURL=edges.js.map