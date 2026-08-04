/**
 * Variable utilities — pure read-only queries over an LdGraph (P1).
 *
 * Powers the Find (Ctrl+F) and Cross Reference (Ctrl+Shift+X) features of the
 * React Flow LD editor. Both functions are pure: same graph in, same result
 * out, no mutation, no handler state.
 *
 * Reference: CODESYS Ctrl+F find + cross-reference list (P1 gap analysis,
 * .sisyphus/plans/ld-editor-complete/plan.md).
 */
import { LdGraph } from './model';
import { ContactNode, CoilNode } from './nodes';

/** A graph element that binds a variable: contact or coil. */
export type VariableNode = ContactNode | CoilNode;

const isVariableNode = (n: LdGraph['nodes'][number]): n is VariableNode =>
    n.type === 'node:contact' || n.type === 'node:coil';

/**
 * Find all contact/coil nodes whose variable name contains `name`
 * (case-insensitive substring match; an empty query matches nothing).
 */
export function findVariable(graph: LdGraph, name: string): VariableNode[] {
    const query = name.trim().toLowerCase();
    if (query.length === 0) {
        return [];
    }
    return graph.nodes.filter(
        (n): n is VariableNode => isVariableNode(n) && n.variableName.toLowerCase().includes(query),
    );
}

/** A variable and every contact/coil element bound to it. */
export interface VariableUsage {
    /** IEC 61131-3 variable name, e.g. "motor_run" */
    name: string;
    /** Number of contacts + coils bound to this variable */
    count: number;
    /** Element IDs in graph order (left-to-right, top-to-bottom) */
    nodeIds: string[];
}

/**
 * List every variable used in the diagram, grouped by name and sorted
 * alphabetically (deterministic ordering for the cross-reference panel).
 */
export function listVariables(graph: LdGraph): VariableUsage[] {
    const byName = new Map<string, string[]>();
    for (const node of graph.nodes) {
        if (!isVariableNode(node)) {
            continue;
        }
        const ids = byName.get(node.variableName);
        if (ids) {
            ids.push(node.id);
        } else {
            byName.set(node.variableName, [node.id]);
        }
    }
    return [...byName.entries()]
        .map(([name, nodeIds]) => ({ name, count: nodeIds.length, nodeIds }))
        .sort((a, b) => a.name.localeCompare(b.name));
}
