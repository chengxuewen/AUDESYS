"use strict";
/**
 * Monarch tokenizer for IEC 61131-3 Instruction List (IL).
 *
 * IL is a line-oriented, accumulator-based language. Each line consists of
 * an optional label, an instruction mnemonic (possibly with modifiers N/C),
 * and an optional operand.
 *
 * Instruction categories (31 total, from audesys-il-compiler):
 *   Bit loads:     LD, LDN
 *   Bit stores:    ST, STN
 *   Bit set/reset: S, R
 *   Bit logic:     AND, ANDN, OR, ORN, XOR, XORN
 *   Arithmetic:    ADD, SUB, MUL, DIV
 *   Comparison:    GT, GE, EQ, NE, LE, LT
 *   Jumps:         JMP, JMPC, JMPCN
 *   Calls:         CAL, CALC, CALCN
 *   Returns:       RET, RETC, RETCN
 *
 * Modifiers:
 *   N  — negate (e.g. ANDN = AND with negation)
 *   C  — conditional (e.g. JMPC = jump if CR true)
 *   (  — deferred execution
 *
 * Accumulator comments: (* CR = ... *) — describe current accumulator value
 *
 * NOTE: Uses locally-defined types to avoid direct monaco-editor dependency.
 * Compatible with @theia/monaco's setMonarchTokensProvider.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createILMonarchLanguage = createILMonarchLanguage;
/** All 31 IL instructions — matched case-insensitively by Monarch */
const IL_INSTRUCTIONS = [
    // Load/store (6)
    'LD', 'LDN',
    'ST', 'STN',
    'S', 'R',
    // Bit logic (6)
    'AND', 'ANDN',
    'OR', 'ORN',
    'XOR', 'XORN',
    // Arithmetic (4)
    'ADD', 'SUB', 'MUL', 'DIV',
    // Comparison (6)
    'GT', 'GE', 'EQ', 'NE', 'LE', 'LT',
    // Jumps (3)
    'JMP', 'JMPC', 'JMPCN',
    // Calls (3)
    'CAL', 'CALC', 'CALCN',
    // Returns (3)
    'RET', 'RETC', 'RETCN',
];
/** Modifier suffixes recognized as part of the instruction token */
const MODIFIER_SUFFIXES = ['N', 'C', 'CN'];
/**
 * Create a Monarch language definition for IEC 61131-3 Instruction List.
 */
function createILMonarchLanguage() {
    return {
        defaultToken: 'invalid',
        ignoreCase: true,
        keywords: IL_INSTRUCTIONS,
        tokenizer: {
            root: [
                // ── Comments (highest priority) ──
                // Block comment: (* ... *)
                [
                    /\(\*/,
                    {
                        token: 'comment',
                        next: '@ilComment',
                    },
                ],
                // ── Labels ──
                // Label definition: start:
                // Must be at the start of line (after optional whitespace).
                // Match:  ^ \s*  identifier :
                [
                    /^(\s*)([a-zA-Z_]\w*)(\s*:)/,
                    [
                        'white',
                        'type.identifier',
                        'delimiter',
                    ],
                ],
                // ── IL Instructions — case-insensitive keywords ──
                // Mnemonics with optional modifiers: LD, LDN, JMPC, CALCN, etc.
                // These are the main keywords.
                [
                    /\b[a-z_]\w*/,
                    {
                        cases: {
                            'keywords': 'keyword',
                            '@default': 'identifier',
                        },
                    },
                ],
                // ── Numbers ──
                // Decimal integer
                [/\b\d+\b/, 'number'],
                // Hex literal: 16#FF or 2#1010
                [/\b(16|2|8)#[0-9a-fA-F]+\b/, 'number.hex'],
                // Float: 3.14, 1e5, 2.5E-3
                [
                    /\b\d+\.\d+([eE][+-]?\d+)?\b/,
                    'number.float',
                ],
                // Time literals: T#5s, T#100ms
                [/\bT#\d+(s|ms|us|ns|m|h|d)\b/, 'number'],
                // ── String literals ──
                [/'[^']*'/, 'string'],
                // ── Operators / delimiters ──
                // Function block dots: ton.Q, counter.PV
                [/\./, 'delimiter'],
                // Parentheses for deferred execution: CAL CMD_1(
                [/[()]/, 'delimiter.parenthesis'],
                // Brackets for array indexing
                [/[\[\]]/, 'delimiter.square'],
                // Comma for parameter lists
                [/,/, 'delimiter'],
                // ── Whitespace ──
                [/\s+/, 'white'],
            ],
            // ── IL Comment State ──
            // Handles (* ... *) including nested content.
            // Accumulator trace comments: (* CR = ... *) are highlighted specially.
            ilComment: [
                // Close comment
                [
                    /\*\)/,
                    { token: 'comment', next: '@pop' },
                ],
                // Accumulator trace: (* CR = VALUE *)
                [
                    /CR\s*=/,
                    { token: 'comment.annotation', next: '@crValue' },
                ],
                // Any comment content
                [/[^*]+/, 'comment'],
                // Stray asterisk
                [/\*/, 'comment'],
            ],
            // ── CR Value sub-state (accumulator trace) ──
            crValue: [
                // True/false values
                [/\b(TRUE|FALSE)\b/i, 'comment.keyword'],
                // Numeric values
                [/\b\d+\b/, 'comment.number'],
                // Close comment from within CR value
                [
                    /\*\)/,
                    { token: 'comment', next: '@popall' },
                ],
                // Anything else inside CR
                [/[^*)]+/, 'comment.annotation'],
                [/\*/, 'comment.annotation'],
                [/\)/, 'comment.annotation'],
            ],
        },
    };
}
//# sourceMappingURL=il-language.js.map