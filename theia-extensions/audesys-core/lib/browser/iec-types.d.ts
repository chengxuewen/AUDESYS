/**
 * IEC 61131-3 type subset (A2-3).
 * Single source of truth for the five basic types supported by GVL / local variable tables.
 * Zero @theia dependency — pure logic, can be unit-tested without a DOM.
 */
/** The five basic IEC types used by the GVL / local variable table editors. */
export declare const IEC_TYPES: Readonly<string[]>;
/** Return true when `type` is one of the five supported IEC types (case-sensitive). */
export declare function isIecType(type: string): boolean;
/**
 * Validate that `init` is a legal initialiser for the given IEC type.
 *
 * Rules:
 * - Empty init ⇒ valid (no initial value declared)
 * - BOOL: TRUE / FALSE / 0 / 1 (case-insensitive)
 * - INT: optional sign followed by digits (e.g. -3, 50)
 * - REAL: integer or decimal, optional exponent (e.g. 20.5, 1.5e3, -0.1)
 * - TIME: empty, or `T#` prefix + duration (e.g. T#2s), or a plain integer (seconds)
 * - STRING: empty, or wrapped in single or double quotes (e.g. 'hello', "world")
 *
 * @returns `null` when valid, otherwise a human-readable error message.
 */
export declare function validateInit(type: string, init: string): string | null;
//# sourceMappingURL=iec-types.d.ts.map