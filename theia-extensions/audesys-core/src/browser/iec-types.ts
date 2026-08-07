/**
 * IEC 61131-3 type subset (A2-3).
 * Single source of truth for the five basic types supported by GVL / local variable tables.
 * Zero @theia dependency — pure logic, can be unit-tested without a DOM.
 */

/** The five basic IEC types used by the GVL / local variable table editors. */
export const IEC_TYPES: Readonly<string[]> = ['BOOL', 'INT', 'REAL', 'TIME', 'STRING'];

/** Return true when `type` is one of the five supported IEC types (case-sensitive). */
export function isIecType(type: string): boolean {
    return IEC_TYPES.includes(type);
}

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
export function validateInit(type: string, init: string): string | null {
    const trimmed = init.trim();
    if (trimmed === '') {
        return null; // no initial value is always allowed
    }

    switch (type) {
        case 'BOOL': {
            if (/^(TRUE|FALSE|0|1)$/i.test(trimmed)) {
                return null;
            }
            return `BOOL value must be TRUE, FALSE, 0, or 1 (got "${trimmed}")`;
        }
        case 'INT': {
            if (/^[+-]?\d+$/.test(trimmed)) {
                return null;
            }
            return `INT value must be an integer (got "${trimmed}")`;
        }
        case 'REAL': {
            if (/^[+-]?(\d+\.?\d*|\d*\.\d+)([eE][+-]?\d+)?$/.test(trimmed)) {
                return null;
            }
            return `REAL value must be a number (got "${trimmed}")`;
        }
        case 'TIME': {
            if (/^T#/.test(trimmed) || /^\d+$/.test(trimmed)) {
                return null;
            }
            return `TIME value must start with T# or be a plain integer in seconds (got "${trimmed}")`;
        }
        case 'STRING': {
            if (
                (/^'.*'$/s.test(trimmed)) ||
                (/^".*"$/s.test(trimmed))
            ) {
                return null;
            }
            return `STRING value must be wrapped in single or double quotes (got "${trimmed}")`;
        }
        default:
            return `Unknown IEC type "${type}"`;
    }
}
