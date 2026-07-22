"use strict";
/**
 * LD GModel — JSON serialization and validation for ladder diagram models.
 *
 * Supports round-trip serialization (`LdGraph` ↔ JSON string) and
 * structural validation to detect orphan nodes, missing wire connections,
 * and inconsistent rung references.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toJSON = toJSON;
exports.fromJSON = fromJSON;
exports.validateGraph = validateGraph;
exports.isValid = isValid;
exports.roundTrip = roundTrip;
// ============================================================================
// Serialization
// ============================================================================
/**
 * Serialize an `LdGraph` to a JSON string.
 *
 * Preserves all node and edge types via their string discriminators,
 * ensuring a round-trip through {@link fromJSON} reconstructs the
 * identical graph.
 *
 * @param graph - The ladder diagram graph model
 * @returns Indented JSON string (2-space)
 */
function toJSON(graph) {
    return JSON.stringify(graph, null, 2);
}
/**
 * Deserialize a JSON string back to an `LdGraph`.
 *
 * Performs a structural parse only; does not validate connectivity.
 * Use {@link validateGraph} after deserialization to check integrity.
 *
 * @param json - A JSON string from {@link toJSON}
 * @returns The reconstructed LdGraph
 * @throws {Error} If the JSON is malformed or not a valid LdGraph shape
 */
function fromJSON(json) {
    const parsed = JSON.parse(json);
    if (!isLdGraph(parsed)) {
        throw new Error('Invalid LdGraph: missing required fields (id, nodes, edges, rungs)');
    }
    return parsed;
}
/**
 * Type guard: checks whether a value has the shape of an LdGraph.
 */
function isLdGraph(value) {
    if (value === null || typeof value !== 'object') {
        return false;
    }
    const obj = value;
    return (typeof obj.id === 'string' &&
        Array.isArray(obj.nodes) &&
        Array.isArray(obj.edges) &&
        Array.isArray(obj.rungs));
}
/**
 * Validate the structural integrity of a ladder diagram graph.
 *
 * Checks performed:
 * 1. **Orphan nodes** — every node must be referenced by at least one rung
 * 2. **Rung connectivity** — every rung must have at least one element
 * 3. **Edge references** — every edge must reference existing source and target nodes
 * 4. **Rung element references** — every element ID in a rung must correspond to
 *    an existing node
 *
 * @param graph - The ladder diagram graph to validate
 * @returns A {@link ValidationResult} with any errors found
 */
function validateGraph(graph) {
    const errors = [];
    // Build lookup sets
    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    const edgeIds = new Set(graph.edges.map((e) => e.id));
    // Collect all node IDs referenced by rungs
    const rungNodeIds = new Set();
    for (const rung of graph.rungs) {
        for (const elemId of rung.elementIds) {
            rungNodeIds.add(elemId);
        }
    }
    // 1. Orphan nodes — nodes not in any rung
    for (const node of graph.nodes) {
        if (!rungNodeIds.has(node.id)) {
            errors.push(`Orphan node: "${node.id}" (type: ${node.type}) is not referenced by any rung`);
        }
    }
    // 2. Rung connectivity — every rung must have at least one element
    for (const rung of graph.rungs) {
        if (rung.elementIds.length === 0) {
            errors.push(`Empty rung: "${rung.id}" (rung ${rung.rungNumber}) has no elements`);
        }
    }
    // 3. Edge references — source and target must exist
    for (const edge of graph.edges) {
        if (!nodeIds.has(edge.sourceId)) {
            errors.push(`Dangling edge source: "${edge.id}" references non-existent source node "${edge.sourceId}"`);
        }
        if (!nodeIds.has(edge.targetId)) {
            errors.push(`Dangling edge target: "${edge.id}" references non-existent target node "${edge.targetId}"`);
        }
    }
    // 4. Rung element references — must point to existing nodes
    for (const rung of graph.rungs) {
        for (const elemId of rung.elementIds) {
            if (!nodeIds.has(elemId)) {
                errors.push(`Invalid rung reference: rung "${rung.id}" (rung ${rung.rungNumber}) ` +
                    `references non-existent node "${elemId}"`);
            }
        }
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
/**
 * Check whether a graph passes validation.
 *
 * Convenience wrapper around {@link validateGraph}.
 *
 * @returns `true` if the graph has no structural errors
 */
function isValid(graph) {
    return validateGraph(graph).valid;
}
// ============================================================================
// Round-Trip Test Helper
// ============================================================================
/**
 * Verify that serialization round-trip preserves graph identity.
 *
 * Serializes the graph to JSON and deserializes it back, then compares
 * key structural properties (node count, edge count, rung count, IDs).
 * Does NOT perform deep equality — use {@link validateGraph} for that.
 *
 * @returns `true` if the round-tripped graph has the same structural counts
 */
function roundTrip(graph) {
    const json = toJSON(graph);
    const restored = fromJSON(json);
    return (restored.nodes.length === graph.nodes.length &&
        restored.edges.length === graph.edges.length &&
        restored.rungs.length === graph.rungs.length &&
        restored.id === graph.id);
}
//# sourceMappingURL=serialization.js.map