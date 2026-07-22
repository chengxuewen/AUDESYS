/**
 * Monarch tokenizer for RS274/NGC G-code.
 *
 * Language features:
 *   - G codes: G0-G94 (motion, plane, unit, coordinate system, return, dwell)
 *   - M codes: M0-M30 (program control, spindle, tool change)
 *   - Axis letters: X/Y/Z/A/B/C plus I/J/K/R for arcs
 *   - Feed (F), Spindle speed (S), Tool (T), Dwell (P), Height offset (H)
 *   - Line numbers: N-prefixed
 *   - Variables: #1-#9999
 *   - Comments: parenthesized (nested) and semicolon line comments
 *   - Block delete (/), optional skip (*), program delimiters (%)
 *   - Numbers: integers, decimals, scientific notation, negative
 *
 * NOTE: Parenthesized comments use Monarch's state stack for nesting support.
 * Each '(' pushes '@parenComment' state; each ')' pops one level.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type MonarchRule = any[];
/* eslint-enable @typescript-eslint/no-explicit-any */

interface MonarchLanguage {
    defaultToken: string;
    ignoreCase?: boolean;
    tokenizer: Record<string, MonarchRule[]>;
}

/**
 * Create a Monarch language definition for RS274/NGC G-code.
 *
 * Returns a plain object compatible with:
 *   monaco.languages.setMonarchTokensProvider('gcode', tokens);
 */
export function createGCodeMonarchLanguage(): MonarchLanguage {
    return {
        defaultToken: 'invalid',
        ignoreCase: true,

        tokenizer: {
            root: [
                // ── Comments ──────────────────────────────────────────
                // Semicolon comment — rest of line
                [/;.*$/, 'comment.line'],

                // Parenthesized comment — push state (handles nesting)
                [/\(/, { token: 'comment', next: '@parenComment' }],

                // ── Line numbers ──────────────────────────────────────
                [/N\d+/, 'keyword.other'],

                // ── G/M codes (fractional part optional, e.g. G1.0) ──
                [/G\d+(\.\d+)?/, 'keyword'],
                [/M\d+(\.\d+)?/, 'keyword'],

                // ── Axis and parameter letters ────────────────────────
                [/[XYZABCIJKR]/, 'type.identifier'],
                [/[FSTPDHQ]/, 'type.identifier'],

                // ── Variables #1-#9999 ────────────────────────────────
                [/#\d+/, 'variable'],

                // ── Numbers (float before int to avoid partial match) ─
                [/-?\d+\.\d+([eE][+-]?\d+)?/, 'number.float'],
                [/-?\d+/, 'number'],

                // ── Special characters ────────────────────────────────
                [/\//, 'delimiter'],
                [/\*/, 'delimiter'],
                [/%/, 'delimiter'],

                // ── Whitespace ────────────────────────────────────────
                [/\s+/, 'white'],
            ],

            parenComment: [
                // Nested open paren — push another comment level
                [/\(/, { token: 'comment', next: '@parenComment' }],
                // Close paren — pop one comment level
                [/\)/, { token: 'comment', next: '@pop' }],
                // Any other content inside comment
                [/[^()]+/, 'comment'],
            ],
        },
    };
}
