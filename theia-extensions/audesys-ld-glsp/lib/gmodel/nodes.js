"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PowerRailSide = exports.CoilType = exports.ContactType = void 0;
// ============================================================================
// Contact Node
// ============================================================================
/**
 * Contact type — determines the contact's switching behaviour.
 *
 * | Type | Symbol  | Behaviour                             |
 * |------|---------|---------------------------------------|
 * | NO   | `-\| \|-` | Closed when variable is TRUE          |
 * | NC   | `-\|/\|-` | Closed when variable is FALSE         |
 */
var ContactType;
(function (ContactType) {
    /** Normally Open — passes power when the variable is TRUE */
    ContactType["NO"] = "NO";
    /** Normally Closed — passes power when the variable is FALSE */
    ContactType["NC"] = "NC";
})(ContactType || (exports.ContactType = ContactType = {}));
// ============================================================================
// Coil Node
// ============================================================================
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
var CoilType;
(function (CoilType) {
    /** Standard output — variable reflects power flow state */
    CoilType["Normal"] = "Normal";
    /** Negated output — variable is inverse of power flow state */
    CoilType["Negated"] = "Negated";
    /** Set (latch) — variable latched to TRUE on power flow */
    CoilType["Set"] = "Set";
    /** Reset (unlatch) — variable latched to FALSE on power flow */
    CoilType["Reset"] = "Reset";
})(CoilType || (exports.CoilType = CoilType = {}));
// ============================================================================
// Power Rail Node
// ============================================================================
/**
 * Which side of the ladder diagram a power rail occupies.
 */
var PowerRailSide;
(function (PowerRailSide) {
    /** Left power rail — source of power flow (positive bus) */
    PowerRailSide["Left"] = "Left";
    /** Right power rail — sink of power flow (negative/neutral bus) */
    PowerRailSide["Right"] = "Right";
})(PowerRailSide || (exports.PowerRailSide = PowerRailSide = {}));
//# sourceMappingURL=nodes.js.map