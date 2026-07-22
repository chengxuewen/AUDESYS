"use strict";
/**
 * FBD GModel — JSON serialization and validation for function block diagram models.
 *
 * Supports round-trip serialization (`FbdGraph` ↔ JSON string) and
 * structural validation to detect feedback loops (via DFS), type
 * mismatches (BOOL→INT connection), dangling ports, and orphan nodes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationSeverity = void 0;
exports.toJSON = toJSON;
exports.fromJSON = fromJSON;
exports.validateGraph = validateGraph;
exports.isValid = isValid;
exports.roundTrip = roundTrip;
const nodes_1 = require("./nodes");
// ============================================================================
// Serialization
// ============================================================================
/**
 * Serialize an `FbdGraph` to a JSON string.
 *
 * Preserves all node and edge types via their string discriminators,
 * ensuring a round-trip through {@link fromJSON} reconstructs the
 * identical graph.
 *
 * @param graph - The function block diagram graph model
 * @returns Indented JSON string (2-space)
 */
function toJSON(graph) {
    return JSON.stringify(graph, null, 2);
}
/**
 * Deserialize a JSON string back to an `FbdGraph`.
 *
 * Performs a structural parse only; does not validate connectivity.
 * Use {@link validateGraph} after deserialization to check integrity.
 *
 * @param json - A JSON string from {@link toJSON}
 * @returns The reconstructed FbdGraph
 * @throws {Error} If the JSON is malformed or not a valid FbdGraph shape
 */
function fromJSON(json) {
    const parsed = JSON.parse(json);
    if (!isFbdGraph(parsed)) {
        throw new Error('Invalid FbdGraph: missing required fields (id, nodes, edges)');
    }
    return parsed;
}
/**
 * Type guard: checks whether a value has the shape of an FbdGraph.
 */
function isFbdGraph(value) {
    if (value === null || typeof value !== 'object') {
        return false;
    }
    const obj = value;
    return (typeof obj.id === 'string' &&
        Array.isArray(obj.nodes) &&
        Array.isArray(obj.edges));
}
// ============================================================================
// Validation
// ============================================================================
/** Severity level for validation findings. */
var ValidationSeverity;
(function (ValidationSeverity) {
    /** Critical error — graph is structurally broken */
    ValidationSeverity["Error"] = "Error";
    /** Warning — graph may produce unexpected behaviour */
    ValidationSeverity["Warning"] = "Warning";
})(ValidationSeverity || (exports.ValidationSeverity = ValidationSeverity = {}));
// ============================================================================
// Graph Validation
// ============================================================================
/**
 * Validate the structural integrity of a function block diagram graph.
 *
 * Checks performed:
 * 1. **Dangling edge references** — every edge must reference existing source and target nodes
 * 2. **Dangling port references** — every edge's sourcePortName/targetPortName must exist
 * 3. **Pin direction rules** — source pin must be Output (or Bidi), target pin must be Input (or Bidi)
 * 4. **Type mismatches** — warns on BOOL→INT, INT→REAL connections that may lose precision
 * 5. **Feedback loop detection** — DFS for cycles (critical: infinite loop risk)
 * 6. **Disconnected nodes** — nodes with no incoming or outgoing edges
 *
 * @param graph - The function block diagram graph to validate
 * @returns A {@link ValidationResult} with findings
 */
function validateGraph(graph) {
    const findings = [];
    // Build lookups
    const nodeById = new Map();
    for (const node of graph.nodes) {
        nodeById.set(node.id, node);
    }
    // 1. Dangling edge references
    for (const edge of graph.edges) {
        if (!nodeById.has(edge.sourceId)) {
            findings.push({
                severity: ValidationSeverity.Error,
                message: `Dangling edge source: "${edge.id}" references non-existent source node "${edge.sourceId}"`,
            });
        }
        if (!nodeById.has(edge.targetId)) {
            findings.push({
                severity: ValidationSeverity.Error,
                message: `Dangling edge target: "${edge.id}" references non-existent target node "${edge.targetId}"`,
            });
        }
    }
    // 2 & 3. Dangling port references + pin direction validation
    for (const edge of graph.edges) {
        const sourceNode = nodeById.get(edge.sourceId);
        const targetNode = nodeById.get(edge.targetId);
        if (sourceNode) {
            const sourcePin = (0, nodes_1.findPin)(sourceNode, edge.sourcePortName);
            if (!sourcePin) {
                findings.push({
                    severity: ValidationSeverity.Error,
                    message: `Dangling source port: edge "${edge.id}" references non-existent port "${edge.sourcePortName}" on node "${sourceNode.id}" (type: ${sourceNode.type})`,
                });
            }
            else if (sourcePin.direction !== nodes_1.PinDirection.Output &&
                sourcePin.direction !== nodes_1.PinDirection.Bidi) {
                findings.push({
                    severity: ValidationSeverity.Error,
                    message: `Invalid source pin direction: edge "${edge.id}" sources from "${edge.sourcePortName}" on "${sourceNode.id}" which is an Input pin (must be Output or Bidi)`,
                });
            }
        }
        if (targetNode) {
            const targetPin = (0, nodes_1.findPin)(targetNode, edge.targetPortName);
            if (!targetPin) {
                findings.push({
                    severity: ValidationSeverity.Error,
                    message: `Dangling target port: edge "${edge.id}" references non-existent port "${edge.targetPortName}" on node "${targetNode.id}" (type: ${targetNode.type})`,
                });
            }
            else if (targetPin.direction !== nodes_1.PinDirection.Input &&
                targetPin.direction !== nodes_1.PinDirection.Bidi) {
                findings.push({
                    severity: ValidationSeverity.Error,
                    message: `Invalid target pin direction: edge "${edge.id}" targets "${edge.targetPortName}" on "${targetNode.id}" which is an Output pin (must be Input or Bidi)`,
                });
            }
        }
        // 4. Type mismatch warning
        if (sourceNode && targetNode) {
            const sourcePin = (0, nodes_1.findPin)(sourceNode, edge.sourcePortName);
            const targetPin = (0, nodes_1.findPin)(targetNode, edge.targetPortName);
            if (sourcePin && targetPin) {
                if (sourcePin.dataType !== targetPin.dataType) {
                    const isImplicitWiden = sourcePin.dataType === 'INT' && targetPin.dataType === 'REAL';
                    const severity = isImplicitWiden
                        ? ValidationSeverity.Warning
                        : ValidationSeverity.Warning;
                    findings.push({
                        severity,
                        message: `Type mismatch: edge "${edge.id}" connects ${sourcePin.dataType} ("${edge.sourcePortName}" on "${sourceNode.id}") to ${targetPin.dataType} ("${edge.targetPortName}" on "${targetNode.id}")`,
                    });
                }
            }
        }
    }
    // 5. Feedback loop detection (DFS cycle detection)
    const feedbackLoops = detectCycles(graph);
    for (const cycle of feedbackLoops) {
        findings.push({
            severity: ValidationSeverity.Error,
            message: `Feedback loop detected: ${cycle.join(' → ')}`,
        });
    }
    // 6. Disconnected nodes
    const connectedNodeIds = new Set();
    for (const edge of graph.edges) {
        connectedNodeIds.add(edge.sourceId);
        connectedNodeIds.add(edge.targetId);
    }
    for (const node of graph.nodes) {
        if (!connectedNodeIds.has(node.id)) {
            findings.push({
                severity: ValidationSeverity.Warning,
                message: `Disconnected node: "${node.id}" (type: ${node.type}) has no connections`,
            });
        }
    }
    const hasErrors = findings.some((f) => f.severity === ValidationSeverity.Error);
    return {
        valid: !hasErrors,
        findings,
    };
}
// ============================================================================
// Cycle Detection (DFS)
// ============================================================================
/**
 * Detect feedback loops (directed cycles) in the graph.
 *
 * Uses iterative DFS with three-colour marking:
 * - WHITE (0): unvisited
 * - GREY (1): in current DFS path (back-edge = cycle)
 * - BLACK (2): fully explored
 *
 * @returns An array of cycles, each cycle is an array of node IDs forming the loop.
 */
function detectCycles(graph) {
    const WHITE = 0;
    const GREY = 1;
    const BLACK = 2;
    const colour = new Map();
    const parent = new Map();
    const cycles = [];
    // Build adjacency list: nodeId → list of successor node IDs
    const adj = new Map();
    for (const node of graph.nodes) {
        adj.set(node.id, []);
        colour.set(node.id, WHITE);
        parent.set(node.id, null);
    }
    for (const edge of graph.edges) {
        const succ = adj.get(edge.sourceId);
        if (succ) {
            succ.push(edge.targetId);
        }
    }
    function dfs(startId) {
        // Iterative DFS stack: [nodeId, iteratorIndex]
        const stack = [{ nodeId: startId, iterIdx: 0 }];
        colour.set(startId, GREY);
        while (stack.length > 0) {
            const frame = stack[stack.length - 1];
            const neighbours = adj.get(frame.nodeId) ?? [];
            if (frame.iterIdx < neighbours.length) {
                const neighbour = neighbours[frame.iterIdx];
                frame.iterIdx += 1;
                const neighbourColour = colour.get(neighbour) ?? WHITE;
                if (neighbourColour === GREY) {
                    // Back-edge found: extract the cycle
                    const cycle = [neighbour];
                    let current = frame.nodeId;
                    while (current !== null && current !== neighbour) {
                        cycle.push(current);
                        current = parent.get(current) ?? null;
                    }
                    cycle.push(neighbour);
                    cycle.reverse();
                    cycles.push(cycle);
                }
                else if (neighbourColour === WHITE) {
                    parent.set(neighbour, frame.nodeId);
                    colour.set(neighbour, GREY);
                    stack.push({ nodeId: neighbour, iterIdx: 0 });
                }
                // BLACK: already fully explored, skip
            }
            else {
                // All neighbours explored
                colour.set(frame.nodeId, BLACK);
                stack.pop();
            }
        }
    }
    for (const nodeId of graph.nodes.map((n) => n.id)) {
        if (colour.get(nodeId) === WHITE) {
            dfs(nodeId);
        }
    }
    return cycles;
}
// ============================================================================
// Convenience
// ============================================================================
/**
 * Check whether a graph passes validation (no errors).
 *
 * Convenience wrapper around {@link validateGraph}.
 *
 * @returns `true` if the graph has no error-level findings
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
 * key structural properties (node count, edge count, ID).
 * Does NOT perform deep equality — use {@link validateGraph} for that.
 *
 * @returns `true` if the round-tripped graph has the same structural counts
 */
function roundTrip(graph) {
    const json = toJSON(graph);
    const restored = fromJSON(json);
    return (restored.nodes.length === graph.nodes.length &&
        restored.edges.length === graph.edges.length &&
        restored.id === graph.id);
}
//# sourceMappingURL=serialization.js.map