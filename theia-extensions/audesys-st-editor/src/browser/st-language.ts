/**
 * Monarch tokenizer for IEC 61131-3 Structured Text (.st files).
 *
 * Provides syntax highlighting for:
 *   - 50+ IEC keywords (control flow, POU declarations, variable modifiers)
 *   - 20+ IEC types
 *   - (* ... *) block comments + // line comments
 *   - '...' single-quoted and "..." double-quoted strings
 *   - Integers, floats, hex/binary/octal bases, TIME#/T# literals
 *   - Operators (:=, <>, .., **, etc.)
 *   - Bracket/brace matching
 *
 * Usage:
 *   import { createStMonarchLanguage } from './st-language';
 *   monaco.languages.register({ id: 'st' });
 *   monaco.languages.setMonarchTokensProvider('st', createStMonarchLanguage());
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MonarchRule = any[];
type MonarchRuleAtom = RegExp | {
    token: string;
    next?: string;
    bracket?: string;
    cases?: Record<string, string>;
    switchTo?: string;
    nextEmbedded?: string;
    log?: string;
};

export interface MonarchLanguage {
    defaultToken: string;
    ignoreCase?: boolean;
    tokenPostfix?: string;
    keywords?: string[];
    typeKeywords?: string[];
    brackets?: Array<{ open: string; close: string; token: string }>;
    tokenizer: Record<string, MonarchRule[]>;
}

export function createStMonarchLanguage(): MonarchLanguage {
    // ── IEC 61131-3 keywords ──────────────────────────────────────────
    const iecKeywords = [
        // ── Control flow ──────────────────────────────────────────
        'IF', 'THEN', 'ELSE', 'ELSIF', 'END_IF',
        'FOR', 'TO', 'BY', 'DO', 'END_FOR',
        'WHILE', 'END_WHILE',
        'REPEAT', 'UNTIL', 'END_REPEAT',
        'CASE', 'OF', 'ELSE', 'END_CASE',
        'RETURN', 'EXIT', 'CONTINUE',
        'JMP', 'JMPC', 'JMPCN',
        'WITH',
        // ── POU declarations ──────────────────────────────────────
        'PROGRAM', 'END_PROGRAM',
        'FUNCTION', 'END_FUNCTION',
        'FUNCTION_BLOCK', 'END_FUNCTION_BLOCK',
        'METHOD', 'END_METHOD',
        'PROPERTY', 'END_PROPERTY',
        'INTERFACE', 'END_INTERFACE',
        'IMPLEMENTS',
        // ── Type declarations ─────────────────────────────────────
        'TYPE', 'END_TYPE',
        'STRUCT', 'END_STRUCT',
        'UNION', 'END_UNION',
        'ENUM', 'END_ENUM',
        'ARRAY', 'OF',
        'REF_TO',
        // ── Variable declarations ─────────────────────────────────
        'VAR', 'END_VAR',
        'VAR_INPUT', 'VAR_OUTPUT', 'VAR_IN_OUT', 'VAR_INOUT',
        'VAR_GLOBAL', 'VAR_TEMP',
        'VAR_EXTERNAL', 'END_VAR',
        'VAR_ACCESS', 'END_VAR',
        'AT', 'RETAIN', 'CONSTANT', 'PERSISTENT',
        'NON_RETAIN',
        // ── Actions / Transitions ─────────────────────────────────
        'ACTION', 'END_ACTION',
        'TRANSITION', 'END_TRANSITION',
        'FROM', 'STEP', 'INITIAL_STEP',
        'END_STEP',
        'SUPER', 'THIS',
        'TASK', 'CONFIGURATION', 'END_CONFIGURATION',
        'RESOURCE', 'END_RESOURCE',
        'ON',
        // ── Boolean literals ─────────────────────────────────────
        'TRUE', 'FALSE', 'NULL',
        // ── Operators (also handled by regex, listed for identifier fallback) ──
        'NOT', 'AND', 'OR', 'XOR', 'MOD',
        'ANDN', 'ORN', 'XORN',
        // ── Extended ─────────────────────────────────────────────
        'CAL', 'CALC', 'CALCN', 'RET', 'RETC', 'RETCN',
        'LD', 'LDN', 'ST', 'STN', 'S', 'R',
        'S1', 'R1',
        'READ_ONLY', 'READ_WRITE',
        'EXTENDS',
    ];

    // ── IEC 61131-3 types ────────────────────────────────────────────
    const iecTypes = [
        // Integer types
        'BOOL', 'BYTE', 'WORD', 'DWORD', 'LWORD',
        // Signed integers
        'SINT', 'INT', 'DINT', 'LINT',
        // Unsigned integers
        'USINT', 'UINT', 'UDINT', 'ULINT',
        // Floating point
        'REAL', 'LREAL',
        // Time types
        'TIME', 'LTIME',
        'DATE', 'LDATE',
        'TIME_OF_DAY', 'TOD', 'LTOD',
        'DATE_AND_TIME', 'DT', 'LDT',
        // Strings
        'STRING', 'WSTRING',
        // Derived
        'ANY', 'ANY_NUM', 'ANY_INT', 'ANY_REAL',
        'ANY_BIT', 'ANY_STRING', 'ANY_DATE',
    ];

    // ── IEC 61131-3 standard functions (highlight as keyword-call) ──
    const iecFunctions = [
        // Numeric
        'ABS', 'SQRT', 'LN', 'LOG', 'EXP', 'EXPT',
        'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN',
        // Selection / comparison
        'SEL', 'MUX', 'MAX', 'MIN', 'LIMIT',
        'GT', 'GE', 'EQ', 'LE', 'LT', 'NE',
        // Bit shift
        'SHL', 'SHR', 'ROL', 'ROR',
        // Type conversion
        'TRUNC', 'REAL_TO_INT', 'INT_TO_REAL', 'TIME_TO_DINT',
        'BOOL_TO_INT', 'INT_TO_BOOL',
        'TO_BOOL', 'TO_BYTE', 'TO_WORD', 'TO_DWORD', 'TO_LWORD',
        'TO_SINT', 'TO_INT', 'TO_DINT', 'TO_LINT',
        'TO_USINT', 'TO_UINT', 'TO_UDINT', 'TO_ULINT',
        'TO_REAL', 'TO_LREAL',
        'TO_STRING', 'TO_WSTRING',
        'TO_TIME', 'TO_DATE', 'TO_TOD', 'TO_DT',
        // String
        'LEN', 'LEFT', 'RIGHT', 'MID', 'CONCAT', 'INSERT',
        'DELETE', 'REPLACE', 'FIND',
        // Timers (IEC 61131-3 standard FBs)
        'TP', 'TON', 'TOF', 'RTC',
        // Counters
        'CTU', 'CTD', 'CTUD',
        // Bistable
        'SR', 'RS',
        // Edge detection
        'R_TRIG', 'F_TRIG',
        // Semaphore
        'SEMA',
    ];

    const language: MonarchLanguage = {
        defaultToken: 'invalid',
        ignoreCase: false,

        keywords: iecKeywords,
        typeKeywords: iecTypes,

        brackets: [
            { open: '{', close: '}', token: 'delimiter.curly' },
            { open: '[', close: ']', token: 'delimiter.square' },
            { open: '(', close: ')', token: 'delimiter.parenthesis' },
        ],

        tokenizer: {
            root: [
                // ── Block comments: (* ... *) ──────────────────────
                // Must come before ( operator to avoid confusion
                [/\(\*/, 'comment', '@commentBlock'],

                // ── Line comments: // ... ──────────────────────────
                [/\/\/.*$/, 'comment'],

                // ── Time / Duration / Date literals ────────────────
                // T#1s500ms, TIME#5m, D#1d, DATE#2021-01-01, TOD#12:00:00, DT#...
                [
                    /(?:TIME|T|DATE|D|TOD|DT|LTIME|LTOD|LDT)#[a-zA-Z0-9_.\-:]+/,
                    'number',
                ],

                // ── Hex / Binary / Octal numbers: 16#FF, 2#1010, 8#77 ──
                [/\d+#[0-9a-fA-F_]+/, 'number.hex'],

                // ── Float numbers (must come before integer) ────────
                // 3.14, .5, 1e10, 2.5E-3, 1.0e+5
                [/(?:\d*\.\d+|\d+\.\d*)(?:[eE][+-]?\d+)?/, 'number.float'],

                // ── Integer numbers ─────────────────────────────────
                [/\d+/, 'number'],

                // ── Double-quoted strings ──────────────────────────
                [/"/, { token: 'string.quote', bracket: '@open', next: '@stringDouble' }],

                // ── Single-quoted strings (IEC standard) ────────────
                [/'/, { token: 'string.quote', bracket: '@open', next: '@stringSingle' }],

                // ── Keywords, types, identifiers ────────────────────
                [
                    /[a-zA-Z_]\w*/,
                    {
                        cases: {
                            typeKeywords: 'type',
                            keywords: 'keyword',
                            '@default': 'identifier',
                        },
                    },
                ],

                // ── Operators: multi-char first ────────────────────
                // := assignment, => alias, .. range, <> not equal,
                // <= less-or-equal, >= greater-or-equal, ** exponent
                [/:=/, 'operator'],
                [/=>/, 'operator'],
                [/\.\./, 'operator'],
                [/<>/, 'operator'],
                [/<=/, 'operator'],
                [/>=/, 'operator'],
                [/\*\*/, 'operator'],
                // Single-char operators
                [/[+\-*/=<>]/, 'operator'],

                // ── Delimiters ─────────────────────────────────────
                [/[{}()\[\]]/, '@brackets'],
                [/[,;:]/, 'delimiter'],
                [/\./, 'delimiter'],

                // ── Whitespace ─────────────────────────────────────
                [/\s+/, 'white'],
            ],

            // ── Block comment state: waiting for *) ──────────────────
            commentBlock: [
                // Nested (* is NOT supported in IEC 61131-3, but some
                // compilers accept it. We do NOT handle nesting here.
                [/\*\)/, 'comment', '@pop'],
                [/[^*]+/, 'comment'],
                [/\*/, 'comment'],
            ],

            // ── Double-quoted string state ──────────────────────────
            stringDouble: [
                // $ escape sequences (IEC 61131-3 standard escape)
                [/\$[Nn]/, 'string.escape'],       // $N = newline
                [/\$[Rr]/, 'string.escape'],       // $R = carriage return
                [/\$[Ll]/, 'string.escape'],       // $L = line feed
                [/\$[Tt]/, 'string.escape'],       // $T = tab
                [/\$[Pp]/, 'string.escape'],       // $P = form feed
                [/\$\$/, 'string.escape'],         // $$ = dollar sign
                [/\$'/, 'string.escape'],          // $' = single quote
                [/\$"/, 'string.escape'],          // $" = double quote
                [/\$[0-9a-fA-F]{2}/, 'string.escape'],  // $XX hex escape
                // Standard backslash escapes (used in some implementations)
                [/\\[nrt\\'"]/, 'string.escape'],
                // End of string
                [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
                // String content
                [/[^"\\$]+/, 'string'],
                // Lone $ without recognized escape
                [/\$/, 'string'],
            ],

            // ── Single-quoted string state ──────────────────────────
            stringSingle: [
                // $ escape sequences
                [/\$[Nn]/, 'string.escape'],
                [/\$[Rr]/, 'string.escape'],
                [/\$[Ll]/, 'string.escape'],
                [/\$[Tt]/, 'string.escape'],
                [/\$[Pp]/, 'string.escape'],
                [/\$\$/, 'string.escape'],
                [/\$'/, 'string.escape'],
                [/\$"/, 'string.escape'],
                [/\$[0-9a-fA-F]{2}/, 'string.escape'],
                // Standard backslash escapes
                [/\\[nrt\\'"]/, 'string.escape'],
                // End of string
                [/'/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
                // String content
                [/[^'\\$]+/, 'string'],
                // Lone $ without recognized escape
                [/\$/, 'string'],
            ],
        },
    };

    return language;
}
