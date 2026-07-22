/**
 * LD GModel — Node type definitions for IEC 61131-3 Ladder Diagram.
 *
 * Defines the graph nodes that represent ladder diagram elements:
 * contacts, coils, power rails, and function block placeholders.
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
 * Base graph node — compatible with GLSP `GNode`.
 *
 * Every visual element in the graph model extends this interface.
 * The `type` discriminator uses GLSP's `node:<kind>` convention.
 */
export interface BaseNode {
    /** Unique identifier within the graph (UUID v4) */
    id: string;
    /** GLSP node type discriminator, e.g. "node:contact" */
    type: string;
    /** Position of the node's top-left corner */
    position: Point;
    /** Bounding box dimensions */
    size: Dimension;
    /** Optional CSS class names for styling */
    cssClasses?: string[];
}
/**
 * Pin on a function block — an input or output connection point.
 *
 * Pins serve as the source/target anchors for wire connections
 * to and from function blocks.
 */
export interface Pin {
    /** Pin identifier, unique within the parent block (e.g. "EN", "IN1") */
    name: string;
    /** IEC 61131-3 data type (e.g. "BOOL", "INT", "REAL") */
    dataType: string;
    /** Position of the pin relative to the parent block's origin */
    position: Point;
}
/**
 * Contact type — determines the contact's switching behaviour.
 *
 * | Type | Symbol  | Behaviour                             |
 * |------|---------|---------------------------------------|
 * | NO   | `-\| \|-` | Closed when variable is TRUE          |
 * | NC   | `-\|/\|-` | Closed when variable is FALSE         |
 */
export declare enum ContactType {
    /** Normally Open — passes power when the variable is TRUE */
    NO = "NO",
    /** Normally Closed — passes power when the variable is FALSE */
    NC = "NC"
}
/**
 * Ladder diagram contact node.
 *
 * A contact reads a Boolean variable and passes or blocks
 * left-to-right power flow based on the variable's value and
 * the contact type.
 *
 * In GLSP, this is a `node:contact` element.
 */
export interface ContactNode extends BaseNode {
    type: 'node:contact';
    /** Contact switching behaviour */
    contactType: ContactType;
    /** IEC 61131-3 variable name bound to this contact (e.g. "X1", "start_btn") */
    variableName: string;
}
/**
 * Coil type — determines how the coil writes to its variable.
 *
 * | Type    | Symbol  | Behaviour                                      |
 * |---------|---------|------------------------------------------------|
 * | Normal  | `-( )-` | Variable = power flow state (each scan)        |
 * | Negated | `-(/)-` | Variable = NOT(power flow state)               |
 * | Set     | `-(S)-` | Latch to TRUE when power flow is TRUE          |
 * | Reset   | `-(R)-` | Latch to FALSE when power flow is TRUE         |
 */
export declare enum CoilType {
    /** Standard output — variable reflects power flow state */
    Normal = "Normal",
    /** Negated output — variable is inverse of power flow state */
    Negated = "Negated",
    /** Set (latch) — variable latched to TRUE on power flow */
    Set = "Set",
    /** Reset (unlatch) — variable latched to FALSE on power flow */
    Reset = "Reset"
}
/**
 * Ladder diagram coil node.
 *
 * A coil writes to a Boolean variable based on the power flow
 * arriving from its left side. It is always the rightmost element
 * on a rung.
 *
 * In GLSP, this is a `node:coil` element.
 */
export interface CoilNode extends BaseNode {
    type: 'node:coil';
    /** Coil output behaviour */
    coilType: CoilType;
    /** IEC 61131-3 variable name bound to this coil (e.g. "Y1", "motor_run") */
    variableName: string;
}
/**
 * Which side of the ladder diagram a power rail occupies.
 */
export declare enum PowerRailSide {
    /** Left power rail — source of power flow (positive bus) */
    Left = "Left",
    /** Right power rail — sink of power flow (negative/neutral bus) */
    Right = "Right"
}
/**
 * Ladder diagram power rail node.
 *
 * Power rails provide the electrical boundaries of the ladder diagram.
 * The left rail is always the power source; the right rail is the return.
 * Every rung connects between the left and right rails.
 *
 * In GLSP, this is a `node:powerrail` element.
 */
export interface PowerRailNode extends BaseNode {
    type: 'node:powerrail';
    /** Which side of the diagram this rail occupies */
    side: PowerRailSide;
}
/**
 * Ladder diagram function block placeholder node.
 *
 * Represents a function block (FB) instance placed on a rung.
 * FBs connect via their input/output pins to wires.
 * Standard EN (enable) and ENO (enable out) pins are always present
 * for IEC 61131-3 compliance.
 *
 * In GLSP, this is a `node:fb` element.
 */
export interface FbPlaceholderNode extends BaseNode {
    type: 'node:fb';
    /** Function block type name (e.g. "TON", "CTU", "ADD") */
    fbType: string;
    /** Input connection pins (always includes "EN" as first pin) */
    inputPins: Pin[];
    /** Output connection pins (always includes "ENO" as first pin) */
    outputPins: Pin[];
}
//# sourceMappingURL=nodes.d.ts.map