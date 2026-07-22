"use strict";
/**
 * FBD → IL Compiler — converts a Function Block Diagram graph to
 * IEC 61131-3 Instruction List (IL) text.
 *
 * The IL text is then compiled to HalProgram via napi-rs `compileFbd`.
 *
 * Ponytail: simple topological-sort → string builder. No AST pipeline.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertGraphToIl = convertGraphToIl;
const nodes_1 = require("../gmodel/nodes");
/**
 * Convert an FBD graph to IL text.
 *
 * Strategy:
 * 1. Build adjacency map from edges
 * 2. Topological sort nodes
 * 3. Emit IL instructions per node
 *
 * @param graph - The FBD graph to convert
 * @returns IL generation result
 */
function convertGraphToIl(graph) {
    const nodeById = new Map();
    for (const n of graph.nodes) {
        nodeById.set(n.id, n);
    }
    // Build adjacency: which edges feed into each node
    const incomingEdges = new Map();
    for (const n of graph.nodes) {
        incomingEdges.set(n.id, []);
    }
    for (const e of graph.edges) {
        const list = incomingEdges.get(e.targetId);
        if (list)
            list.push(e);
    }
    // Topological sort via Kahn's algorithm
    const inDegree = new Map();
    for (const n of graph.nodes) {
        inDegree.set(n.id, (incomingEdges.get(n.id) ?? []).length);
    }
    const queue = [];
    for (const n of graph.nodes) {
        if (inDegree.get(n.id) === 0)
            queue.push(n.id);
    }
    const sorted = [];
    while (queue.length > 0) {
        const id = queue.shift();
        const node = nodeById.get(id);
        if (node)
            sorted.push(node);
        // Decrement successors
        for (const e of graph.edges) {
            if (e.sourceId === id) {
                const deg = inDegree.get(e.targetId) ?? 1;
                inDegree.set(e.targetId, deg - 1);
                if (deg - 1 === 0)
                    queue.push(e.targetId);
            }
        }
    }
    // Generate labels for edges (for IL variable naming)
    const wireLabels = new Map();
    let labelCounter = 0;
    for (const e of graph.edges) {
        const srcNode = nodeById.get(e.sourceId);
        const srcPin = srcNode ? (0, nodes_1.findPin)(srcNode, e.sourcePortName) : undefined;
        const name = srcPin ? `tmp_${srcPin.name}_${labelCounter}` : `tmp_${labelCounter}`;
        wireLabels.set(e.id, name);
        labelCounter += 1;
    }
    // Emit IL
    const lines = [];
    const variables = [];
    for (const node of sorted) {
        if ((0, nodes_1.isGateNode)(node)) {
            emitGateNode(node, graph, incomingEdges, wireLabels, lines, variables);
        }
        else if ((0, nodes_1.isFunctionBlockNode)(node)) {
            emitFbNode(node, graph, incomingEdges, wireLabels, lines, variables);
        }
    }
    return {
        ilText: lines.join('\n'),
        variables,
    };
}
// ── Node Emitters ───────────────────────────────────────────
function emitGateNode(node, graph, incoming, wireLabels, lines, variables) {
    const inputEdges = incoming.get(node.id) ?? [];
    // Collect input wire names in pin order
    const inputValues = node.inputPorts.map((pin) => {
        const edge = inputEdges.find((e) => e.targetPortName === pin.name);
        return edge ? wireLabels.get(edge.id) ?? 'FALSE' : 'FALSE';
    });
    const outWire = findOutgoingEdge(node.id, graph);
    const outLabel = outWire ? wireLabels.get(outWire.id) ?? `gate_out_${node.id}` : `gate_out_${node.id}`;
    if (!outWire) {
        variables.push(outLabel);
    }
    switch (node.gateType) {
        case nodes_1.GateType.NOT:
            lines.push(`LDN ${inputValues[0]}  (* NOT ${node.id} *)`);
            break;
        case nodes_1.GateType.AND:
            if (inputValues.length === 2) {
                lines.push(`LD  ${inputValues[0]}  (* AND ${node.id} *)`);
                lines.push(`AND ${inputValues[1]}`);
            }
            else {
                lines.push(`LD  ${inputValues[0]}`);
                for (let i = 1; i < inputValues.length; i++) {
                    lines.push(`AND ${inputValues[i]}`);
                }
            }
            break;
        case nodes_1.GateType.OR:
            if (inputValues.length === 2) {
                lines.push(`LD  ${inputValues[0]}  (* OR ${node.id} *)`);
                lines.push(`OR  ${inputValues[1]}`);
            }
            else {
                lines.push(`LD  ${inputValues[0]}`);
                for (let i = 1; i < inputValues.length; i++) {
                    lines.push(`OR  ${inputValues[i]}`);
                }
            }
            break;
        case nodes_1.GateType.XOR:
            lines.push(`LD  ${inputValues[0]}  (* XOR ${node.id} *)`);
            lines.push(`XOR ${inputValues[1]}`);
            break;
        case nodes_1.GateType.MUX:
            lines.push(`LD  ${inputValues[0]}  (* MUX SEL ${node.id} *)`);
            lines.push(`JMPC mux_${node.id}_sel0`);
            lines.push(`LD  ${inputValues[1]}`);
            lines.push(`JMP  mux_${node.id}_end`);
            lines.push(`mux_${node.id}_sel0:`);
            lines.push(`LD  ${inputValues[2]}`);
            lines.push(`mux_${node.id}_end:`);
            break;
    }
    lines.push(`ST  ${outLabel}`);
}
function emitFbNode(node, graph, incoming, wireLabels, lines, variables) {
    const inputEdges = incoming.get(node.id) ?? [];
    // Build CAL parameter list: IN1:=wire1, IN2:=wire2, ...
    const params = node.inputPorts.map((pin) => {
        const edge = inputEdges.find((e) => e.targetPortName === pin.name);
        const value = edge ? wireLabels.get(edge.id) ?? '0' : '0';
        return `${pin.name}:=${value}`;
    });
    lines.push(`CAL ${node.fbType}(${params.join(', ')})  (* FB ${node.id} *)`);
    // Store outputs
    for (const pin of node.outputPorts) {
        const outEdge = graph.edges.find((e) => e.sourceId === node.id && e.sourcePortName === pin.name);
        const label = outEdge
            ? wireLabels.get(outEdge.id) ?? `fb_${node.id}_${pin.name}`
            : `fb_${node.id}_${pin.name}`;
        if (!outEdge)
            variables.push(label);
        lines.push(`ST  ${label}`);
    }
}
// ── Helpers ─────────────────────────────────────────────────
function findOutgoingEdge(nodeId, graph) {
    return graph.edges.find((e) => e.sourceId === nodeId);
}
//# sourceMappingURL=fbd-compile.js.map