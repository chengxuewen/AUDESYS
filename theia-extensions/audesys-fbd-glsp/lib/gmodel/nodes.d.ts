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
/** 2D point in the diagram canvas, in abstract units (pixels at 1x scale). */
export interface Point {
    /** Horizontal coordinate, left-to-right */
    x: number;
    /** Vertical coordinate, top-to-bottom */
    y: number;
}
/** Width and height of a diagram element. */
export interface Dimension {
    /** Width in abstract units */
    width: number;
    /** Height in abstract units */
    height: number;
}
/**
 * Pin direction — determines valid connection rules.
 *
 * In FBD, signals flow from output pins to input pins only.
 * Bidirectional pins are reserved for special cases (e.g. MUX select).
 */
export declare enum PinDirection {
    /** Signal source — can only be an edge source */
    Output = "Output",
    /** Signal sink — can only be an edge target */
    Input = "Input",
    /** Bidirectional — allowed as either source or target (rare, e.g. MUX select) */
    Bidi = "Bidi"
}
/**
 * Base graph node — compatible with GLSP `GNode`.
 *
 * Every visual element in the graph model extends this interface.
 * The `type` discriminator uses GLSP's `node:<kind>` convention.
 */
export interface BaseNode {
    /** Unique identifier within the graph (UUID v4) */
    id: string;
    /** GLSP node type discriminator, e.g. "node:gate" */
    type: string;
    /** Position of the node's top-left corner */
    position: Point;
    /** Bounding box dimensions */
    size: Dimension;
    /** Optional CSS class names for styling */
    cssClasses?: string[];
}
/**
 * Pin on a gate or function block — an input or output connection point.
 *
 * Pins serve as the source/target anchors for signal wire connections.
 * Each pin has a data type for type compatibility checking.
 */
export interface Pin {
    /** Pin identifier, unique within the parent block (e.g. "IN1", "OUT", "SEL") */
    name: string;
    /** IEC 61131-3 data type (e.g. "BOOL", "INT", "REAL") */
    dataType: string;
    /** Input/Output/Bidi direction */
    direction: PinDirection;
    /** Position of the pin relative to the parent block's origin */
    position: Point;
}
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
export declare enum GateType {
    /** Logical AND — all inputs must be TRUE for output TRUE */
    AND = "AND",
    /** Logical OR — any input TRUE gives output TRUE */
    OR = "OR",
    /** Exclusive OR — odd number of TRUE inputs gives output TRUE */
    XOR = "XOR",
    /** Logical NOT — inverts the single input */
    NOT = "NOT",
    /** Multiplexer — selects one of N inputs based on SEL value */
    MUX = "MUX"
}
/**
 * Logic gate node.
 *
 * Represents a single logic gate in the FBD diagram. Each gate type
 * has a specific number and arrangement of input/output pins.
 *
 * In GLSP, this is a `node:gate` element.
 */
export interface GateNode extends BaseNode {
    type: 'node:gate';
    /** Logic gate type */
    gateType: GateType;
    /** Input connection pins (at least 1 for NOT, 2+ for AND/OR/XOR/MUX) */
    inputPorts: Pin[];
    /** Output connection pins (exactly 1 for all gate types) */
    outputPorts: Pin[];
}
/**
 * Function block (FB) instance node.
 *
 * Represents an IEC 61131-3 function block placed in the FBD diagram.
 * FBs can be standard library blocks (e.g. TON, CTU, ADD, MOVE) or
 * custom user-defined blocks. Inputs are on the left, outputs on the right.
 *
 * In GLSP, this is a `node:fb` element.
 */
export interface FunctionBlockNode extends BaseNode {
    type: 'node:fb';
    /** Function block type name (e.g. "TON", "CTU", "ADD", "MOVE") */
    fbType: string;
    /** Input connection pins */
    inputPorts: Pin[];
    /** Output connection pins */
    outputPorts: Pin[];
}
/** Check if a node is a GateNode. */
export declare function isGateNode(node: BaseNode): node is GateNode;
/** Check if a node is a FunctionBlockNode. */
export declare function isFunctionBlockNode(node: BaseNode): node is FunctionBlockNode;
/**
 * Get all input pins from a node.
 * Returns an empty array if the node type doesn't have inputPorts.
 */
export declare function getInputPorts(node: BaseNode): Pin[];
/**
 * Get all output pins from a node.
 * Returns an empty array if the node type doesn't have outputPorts.
 */
export declare function getOutputPorts(node: BaseNode): Pin[];
/**
 * Find a pin by name on a node.
 * @returns The matching Pin or undefined if not found.
 */
export declare function findPin(node: BaseNode, pinName: string): Pin | undefined;
/**
 * Default gate dimensions by type (for factory default sizing).
 */
export declare const GATE_DEFAULT_SIZES: Record<GateType, Dimension>;
//# sourceMappingURL=nodes.d.ts.map