"use strict";
/**
 * FBD GModel — Node type definitions for IEC 61131-3 Function Block Diagram.
 *
 * Defines the graph nodes that represent FBD elements:
 * logic gates (AND, OR, XOR, NOT, MUX) and function block instances.
 *
 * These types are GLSP-compatible: each node extends the base GNode
 * interface and uses string discriminator types following the
 * GLSP `node:<kind>` convention.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GATE_DEFAULT_SIZES = exports.GateType = exports.PinDirection = void 0;
exports.isGateNode = isGateNode;
exports.isFunctionBlockNode = isFunctionBlockNode;
exports.getInputPorts = getInputPorts;
exports.getOutputPorts = getOutputPorts;
exports.findPin = findPin;
// ============================================================================
// Pin Direction
// ============================================================================
/**
 * Pin direction — determines valid connection rules.
 *
 * In FBD, signals flow from output pins to input pins only.
 * Bidirectional pins are reserved for special cases (e.g. MUX select).
 */
var PinDirection;
(function (PinDirection) {
    /** Signal source — can only be an edge source */
    PinDirection["Output"] = "Output";
    /** Signal sink — can only be an edge target */
    PinDirection["Input"] = "Input";
    /** Bidirectional — allowed as either source or target (rare, e.g. MUX select) */
    PinDirection["Bidi"] = "Bidi";
})(PinDirection || (exports.PinDirection = PinDirection = {}));
// ============================================================================
// Gate Node
// ============================================================================
/**
 * Logic gate type — the fundamental FBD operation elements.
 *
 * | Type | Pins            | Behaviour                         |
 * |------|-----------------|-----------------------------------|
 * | AND  | N in, 1 out     | OUT = IN1 ∧ IN2 ∧ ... ∧ INn       |
 * | OR   | N in, 1 out     | OUT = IN1 ∨ IN2 ∨ ... ∨ INn       |
 * | XOR  | N in, 1 out     | OUT = IN1 ⊕ IN2 ⊕ ... ⊕ INn       |
 * | NOT  | 1 in, 1 out     | OUT = ¬IN                         |
 * | MUX  | SEL+2N in, 1 out| OUT = (SEL=0) ? IN0 : IN1         |
 */
var GateType;
(function (GateType) {
    /** Logical AND — all inputs must be TRUE for output TRUE */
    GateType["AND"] = "AND";
    /** Logical OR — any input TRUE gives output TRUE */
    GateType["OR"] = "OR";
    /** Exclusive OR — odd number of TRUE inputs gives output TRUE */
    GateType["XOR"] = "XOR";
    /** Logical NOT — inverts the single input */
    GateType["NOT"] = "NOT";
    /** Multiplexer — selects one of N inputs based on SEL value */
    GateType["MUX"] = "MUX";
})(GateType || (exports.GateType = GateType = {}));
// ============================================================================
// Type Guard Helpers
// ============================================================================
/** Check if a node is a GateNode. */
function isGateNode(node) {
    return node.type === 'node:gate';
}
/** Check if a node is a FunctionBlockNode. */
function isFunctionBlockNode(node) {
    return node.type === 'node:fb';
}
/**
 * Get all input pins from a node.
 * Returns an empty array if the node type doesn't have inputPorts.
 */
function getInputPorts(node) {
    if (isGateNode(node) || isFunctionBlockNode(node)) {
        return node.inputPorts;
    }
    return [];
}
/**
 * Get all output pins from a node.
 * Returns an empty array if the node type doesn't have outputPorts.
 */
function getOutputPorts(node) {
    if (isGateNode(node) || isFunctionBlockNode(node)) {
        return node.outputPorts;
    }
    return [];
}
/**
 * Find a pin by name on a node.
 * @returns The matching Pin or undefined if not found.
 */
function findPin(node, pinName) {
    const allPins = [...getInputPorts(node), ...getOutputPorts(node)];
    return allPins.find((p) => p.name === pinName);
}
/**
 * Default gate dimensions by type (for factory default sizing).
 */
exports.GATE_DEFAULT_SIZES = {
    [GateType.AND]: { width: 60, height: 60 },
    [GateType.OR]: { width: 60, height: 60 },
    [GateType.XOR]: { width: 60, height: 60 },
    [GateType.NOT]: { width: 50, height: 50 },
    [GateType.MUX]: { width: 70, height: 70 },
};
//# sourceMappingURL=nodes.js.map