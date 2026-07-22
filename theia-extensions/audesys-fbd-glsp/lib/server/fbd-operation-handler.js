"use strict";
/**
 * FBD Operation Handler — thin dispatch layer for Function Block Diagram GLSP operations.
 *
 * Ponytail: one class, one file. ~60% reused from LD pattern.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FbdOperationHandler = void 0;
const model_1 = require("../gmodel/model");
const nodes_1 = require("../gmodel/nodes");
const serialization_1 = require("../gmodel/serialization");
const fbd_compile_1 = require("./fbd-compile");
const fbd_fb_registry_1 = require("./fbd-fb-registry");
function defaultCompile(source) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@audesys/theia-bridge').compileFbd(source);
}
function parseCompileOutput(raw) {
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return {
                success: false, programJson: '',
                diagnostics: parsed.map((d, i) => ({
                    severity: d.severity || 'error',
                    line: d.line,
                    message: d.message || String(d),
                    code: d.code || `E${String(i).padStart(3, '0')}`,
                })),
            };
        }
        if (typeof parsed === 'object' && parsed !== null && 'instructions' in parsed) {
            return { success: true, programJson: raw, diagnostics: [] };
        }
        return { success: false, programJson: '', diagnostics: [{ severity: 'error', message: 'Unknown compile output', code: 'E999' }] };
    }
    catch {
        return { success: false, programJson: '', diagnostics: [{ severity: 'error', message: raw, code: 'E998' }] };
    }
}
// ============================================================================
// Snapping
// ============================================================================
const GRID_X = 20;
const GRID_Y = 20;
function snapToGrid(p) {
    return { x: Math.round(p.x / GRID_X) * GRID_X, y: Math.round(p.y / GRID_Y) * GRID_Y };
}
// ============================================================================
// FB Factory Helper
// ============================================================================
function createFbWithPins(fbType, position) {
    const def = (0, fbd_fb_registry_1.getFbDef)(fbType);
    if (def) {
        const inputs = def.inputs.map((d, i) => (0, model_1.createInputPin)(d.name, d.dataType, i, def.inputs.length));
        const w = Math.max(120, fbType.length * 8 + 40);
        const outputs = def.outputs.map((d, i) => (0, model_1.createOutputPin)(d.name, d.dataType, w, i, def.outputs.length));
        return (0, model_1.createFB)(fbType, inputs, outputs, position);
    }
    // ponytail: unknown type → generic 2-in, 2-out
    return (0, model_1.createFB)(fbType, [(0, model_1.createInputPin)('IN1', 'BOOL', 0, 2), (0, model_1.createInputPin)('IN2', 'BOOL', 1, 2)], [(0, model_1.createOutputPin)('Q1', 'BOOL', 120, 0, 2), (0, model_1.createOutputPin)('Q2', 'BOOL', 120, 1, 2)], position);
}
// ============================================================================
// FbdOperationHandler
// ============================================================================
class FbdOperationHandler {
    constructor(compileFn) {
        this.compileFn = compileFn ?? defaultCompile;
    }
    /** Create a gate node with default pins. */
    createGate(graph, params) {
        const gate = (0, model_1.createGate)(params.gateType, snapToGrid(params.position));
        const next = cloneGraph(graph);
        next.nodes.push(gate);
        return next;
    }
    /** Create a function block with type-specific pins. */
    createFunctionBlock(graph, params) {
        const fb = createFbWithPins(params.fbType, snapToGrid(params.position));
        const next = cloneGraph(graph);
        next.nodes.push(fb);
        return next;
    }
    /** Delete a node and all connected edges. */
    deleteElement(graph, params) {
        if (!findNode(graph, params.elementId))
            throw new ValidationError(`Element not found: ${params.elementId}`);
        const next = cloneGraph(graph);
        next.nodes = next.nodes.filter((n) => n.id !== params.elementId);
        next.edges = next.edges.filter((e) => e.sourceId !== params.elementId && e.targetId !== params.elementId);
        return next;
    }
    /** Connect output pin → input pin. Validates direction + type. */
    connectPins(graph, params) {
        const srcNode = validatePin(graph, params.sourceNodeId, params.sourcePortName, 'source');
        const tgtNode = validatePin(graph, params.targetNodeId, params.targetPortName, 'target');
        const srcPin = (0, nodes_1.findPin)(srcNode, params.sourcePortName);
        const tgtPin = (0, nodes_1.findPin)(tgtNode, params.targetPortName);
        if (srcPin.direction !== nodes_1.PinDirection.Output && srcPin.direction !== nodes_1.PinDirection.Bidi) {
            throw new ValidationError(`Source pin "${params.sourcePortName}" is ${srcPin.direction}, must be Output/Bidi`);
        }
        if (tgtPin.direction !== nodes_1.PinDirection.Input && tgtPin.direction !== nodes_1.PinDirection.Bidi) {
            throw new ValidationError(`Target pin "${params.targetPortName}" is ${tgtPin.direction}, must be Input/Bidi`);
        }
        if (srcPin.dataType !== tgtPin.dataType) {
            const ok = srcPin.dataType === 'INT' && tgtPin.dataType === 'REAL';
            if (!ok)
                throw new ValidationError(`Type mismatch: ${srcPin.dataType} → ${tgtPin.dataType}`);
        }
        // Duplicate check — idempotent
        const dup = graph.edges.find((e) => e.sourceId === params.sourceNodeId && e.sourcePortName === params.sourcePortName &&
            e.targetId === params.targetNodeId && e.targetPortName === params.targetPortName);
        if (dup)
            return graph;
        const edge = (0, model_1.createSignalEdge)(params.sourceNodeId, params.sourcePortName, params.targetNodeId, params.targetPortName);
        const next = cloneGraph(graph);
        next.edges.push(edge);
        return next;
    }
    /** Disconnect all edges on a node's port. */
    disconnectPin(graph, params) {
        if (!findNode(graph, params.nodeId))
            throw new ValidationError(`Node not found: ${params.nodeId}`);
        const next = cloneGraph(graph);
        next.edges = next.edges.filter((e) => !((e.sourceId === params.nodeId && e.sourcePortName === params.portName) ||
            (e.targetId === params.nodeId && e.targetPortName === params.portName)));
        return next;
    }
    /** Move node to new position (snap to grid). */
    moveElement(graph, params) {
        if (!findNode(graph, params.elementId))
            throw new ValidationError(`Element not found: ${params.elementId}`);
        const next = cloneGraph(graph);
        const idx = next.nodes.findIndex((n) => n.id === params.elementId);
        if (idx >= 0)
            next.nodes[idx] = { ...next.nodes[idx], position: snapToGrid(params.newPosition) };
        return next;
    }
    /** Change gate type, regenerating pins. Preserves element ID. */
    changeGateType(graph, params) {
        const node = findNode(graph, params.elementId);
        if (!node || !(0, nodes_1.isGateNode)(node))
            throw new ValidationError(`Not a gate: ${params.elementId}`);
        if (node.gateType === params.newGateType)
            return graph;
        const newGate = (0, model_1.createGate)(params.newGateType, node.position);
        const next = cloneGraph(graph);
        const idx = next.nodes.findIndex((n) => n.id === params.elementId);
        if (idx >= 0)
            next.nodes[idx] = { ...newGate, id: params.elementId };
        return next;
    }
    /** Change FB type, regenerating pins. Removes edges to obsolete pins. */
    changeFbType(graph, params) {
        const node = findNode(graph, params.fbId);
        if (!node || !(0, nodes_1.isFunctionBlockNode)(node))
            throw new ValidationError(`Not an FB: ${params.fbId}`);
        if (node.fbType === params.newFbType)
            return graph;
        const newFb = createFbWithPins(params.newFbType, node.position);
        const next = cloneGraph(graph);
        const idx = next.nodes.findIndex((n) => n.id === params.fbId);
        if (idx >= 0)
            next.nodes[idx] = { ...newFb, id: params.fbId };
        const validPins = new Set([...newFb.inputPorts, ...newFb.outputPorts].map((p) => p.name));
        next.edges = next.edges.filter((e) => {
            if (e.sourceId === params.fbId && !validPins.has(e.sourcePortName))
                return false;
            if (e.targetId === params.fbId && !validPins.has(e.targetPortName))
                return false;
            return true;
        });
        return next;
    }
    /** Validate: structural + unconnected output pin warnings. */
    validate(graph) {
        const result = (0, serialization_1.validateGraph)(graph);
        for (const node of graph.nodes) {
            const outputs = (0, nodes_1.isGateNode)(node) ? node.outputPorts : (0, nodes_1.isFunctionBlockNode)(node) ? node.outputPorts : [];
            for (const pin of outputs) {
                const hasEdge = graph.edges.some((e) => e.sourceId === node.id && e.sourcePortName === pin.name);
                if (!hasEdge)
                    result.findings.push({ severity: serialization_1.ValidationSeverity.Warning, message: `Unconnected output: "${pin.name}" on ${node.type} "${node.id}"` });
            }
        }
        return { valid: result.valid, findings: result.findings };
    }
    /** Compile: validate → FBD→IL → napi-rs compileFbd → HalProgram. */
    compile(graph) {
        const validation = this.validate(graph);
        if (!validation.valid) {
            const errors = validation.findings.filter((f) => f.severity === 'Error');
            return {
                success: false, programJson: '',
                diagnostics: errors.map((f, i) => ({ severity: 'error', message: f.message, code: `V${String(i + 1).padStart(3, '0')}` })),
            };
        }
        try {
            const ilResult = (0, fbd_compile_1.convertGraphToIl)(graph);
            return parseCompileOutput(this.compileFn(ilResult.ilText));
        }
        catch (err) {
            return {
                success: false, programJson: '',
                diagnostics: [{ severity: 'error', message: err instanceof Error ? err.message : String(err), code: 'E999' }],
            };
        }
    }
}
exports.FbdOperationHandler = FbdOperationHandler;
// ============================================================================
// Helpers
// ============================================================================
class ValidationError extends Error {
    constructor(message) { super(message); this.name = 'ValidationError'; }
}
function cloneGraph(graph) {
    return JSON.parse(JSON.stringify(graph));
}
function findNode(graph, nodeId) {
    return graph.nodes.find((n) => n.id === nodeId);
}
function validatePin(graph, nodeId, portName, role) {
    const node = findNode(graph, nodeId);
    if (!node)
        throw new ValidationError(`${role} node not found: ${nodeId}`);
    const pin = (0, nodes_1.findPin)(node, portName);
    if (!pin)
        throw new ValidationError(`${role} port "${portName}" not found on ${node.type} "${nodeId}"`);
    return node;
}
//# sourceMappingURL=fbd-operation-handler.js.map