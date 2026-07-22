"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.resetIdCounter = resetIdCounter;
exports.createInputPin = createInputPin;
exports.createOutputPin = createOutputPin;
exports.createGate = createGate;
exports.createFB = createFB;
exports.createSignalEdge = createSignalEdge;
exports.createFbdGraph = createFbdGraph;
const nodes_1 = require("./nodes");
// ============================================================================
// Factory Functions
// ============================================================================
let nextId = 0;
/**
 * Generate a unique element ID.
 *
 * Uses a simple monotonic counter prefixed for readability.
 * In production, this would be replaced with UUID v4 generation.
 */
function generateId(prefix) {
    nextId += 1;
    return `${prefix}-${nextId}`;
}
/**
 * Reset the ID counter. Useful for deterministic tests.
 */
function resetIdCounter() {
    nextId = 0;
}
// ============================================================================
// Pin Factory
// ============================================================================
/**
 * Create an input pin with default position at left edge of the block.
 *
 * @param name - Pin identifier (e.g. "IN1", "EN")
 * @param dataType - IEC 61131-3 data type (e.g. "BOOL")
 * @param index - 0-based index among input pins (used for Y positioning)
 * @param totalPins - Total number of pins on this side (used for spacing)
 * @returns A fully-formed input Pin
 */
function createInputPin(name, dataType, index, totalPins) {
    const spacing = 24;
    const startY = spacing * (totalPins - 1) / 2;
    return {
        name,
        dataType,
        direction: nodes_1.PinDirection.Input,
        position: { x: 0, y: index * spacing - startY },
    };
}
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
function createOutputPin(name, dataType, blockWidth, index, totalPins) {
    const spacing = 24;
    const startY = spacing * (totalPins - 1) / 2;
    return {
        name,
        dataType,
        direction: nodes_1.PinDirection.Output,
        position: { x: blockWidth, y: index * spacing - startY },
    };
}
// ============================================================================
// Gate Factory
// ============================================================================
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
function createGate(gateType, position) {
    const size = nodes_1.GATE_DEFAULT_SIZES[gateType];
    const inputNames = getDefaultInputPinNames(gateType);
    const inputPorts = inputNames.map((name, i) => createInputPin(name, 'BOOL', i, inputNames.length));
    const outputPorts = [
        createOutputPin('OUT', 'BOOL', size.width, 0, 1),
    ];
    return {
        id: generateId('gate'),
        type: 'node:gate',
        gateType,
        inputPorts,
        outputPorts,
        position: position ?? { x: 0, y: 0 },
        size,
    };
}
/**
 * Get the default input pin names for a gate type.
 */
function getDefaultInputPinNames(gateType) {
    switch (gateType) {
        case nodes_1.GateType.NOT:
            return ['IN'];
        case nodes_1.GateType.MUX:
            return ['SEL', 'IN0', 'IN1'];
        case nodes_1.GateType.AND:
        case nodes_1.GateType.OR:
        case nodes_1.GateType.XOR:
        default:
            return ['IN1', 'IN2'];
    }
}
// ============================================================================
// Function Block Factory
// ============================================================================
/**
 * Create a function block node.
 *
 * @param fbType - FB type name (e.g. "TON", "CTU", "ADD", "MOVE")
 * @param inputPins - Array of input pins
 * @param outputPins - Array of output pins
 * @param position - Canvas position (defaults to origin)
 * @returns A fully-formed FunctionBlockNode
 */
function createFB(fbType, inputPins, outputPins, position) {
    const pinCount = Math.max(inputPins.length, outputPins.length);
    const height = Math.max(60, pinCount * 28 + 16);
    return {
        id: generateId('fb'),
        type: 'node:fb',
        fbType,
        inputPorts: inputPins,
        outputPorts: outputPins,
        position: position ?? { x: 0, y: 0 },
        size: { width: 120, height },
    };
}
// ============================================================================
// Edge Factory
// ============================================================================
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
function createSignalEdge(sourceId, sourcePortName, targetId, targetPortName, routingPoints) {
    return {
        id: generateId('signal'),
        type: 'edge:signal',
        sourceId,
        sourcePortName,
        targetId,
        targetPortName,
        routingPoints,
    };
}
// ============================================================================
// Graph Factory
// ============================================================================
/**
 * Create an empty function block diagram graph.
 *
 * @param id - Optional graph ID (auto-generated if omitted)
 * @returns An empty FbdGraph
 */
function createFbdGraph(id) {
    return {
        id: id ?? generateId('fbdgraph'),
        nodes: [],
        edges: [],
    };
}
//# sourceMappingURL=model.js.map