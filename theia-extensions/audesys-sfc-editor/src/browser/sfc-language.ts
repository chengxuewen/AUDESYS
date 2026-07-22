/**
 * Monarch tokenizer for IEC 61131-3 Sequential Function Chart (SFC) — text mode.
 *
 * This is a text-only SFC representation. Graphical editing is Phase 2+.
 * The tokenizer highlights SFC structural keywords, action qualifiers, and
 * embedded ST (Structured Text) expressions within TRANSITION conditions.
 *
 * Language features:
 *   - Structural keywords: STEP, TRANSITION, ACTION, SELECTION/SIMULTANEOUS_BRANCH
 *   - Action qualifiers: N, S, R, L, D, P, P0, P1
 *   - Embedded ST expressions inside TRANSITION blocks
 *   - IEC 61131-3 comments: (* ... *)
 *   - Time/Duration/Date literals: T#5s, DATE#2024-01-01
 *   - String and number literals
 *   - GOTO step_name labels
 *
 * NOTE: This module does NOT import from monaco-editor directly.
 * Types are locally-defined for self-containment. In Theia, the Monarch
 * definition is passed to monaco.languages.setMonarchTokensProvider().
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MonarchRule = any[];

interface MonarchLanguage {
    defaultToken: string;
    ignoreCase?: boolean;
    brackets?: Array<{ open: string; close: string; token: string }>;
    keywords?: string[];
    typeKeywords?: string[];
    operators?: string[];
    tokenizer: Record<string, MonarchRule[]>;
}

export function createSfcMonarchLanguage(): MonarchLanguage {
    const language: MonarchLanguage = {
        defaultToken: 'invalid',
        ignoreCase: false,

        // --- SFC structural keywords ---
        keywords: [
            'INITIAL_STEP', 'STEP', 'END_STEP',
            'TRANSITION', 'END_TRANSITION', 'FROM', 'TO',
            'ACTION', 'END_ACTION',
            'SELECTION_BRANCH', 'END_SELECTION',
            'SIMULTANEOUS_BRANCH', 'END_SIMULTANEOUS',
            'BRANCH', 'END_BRANCH',
            'GOTO',
        ],

        // --- IEC 61131-3 data types ---
        typeKeywords: [
            'BOOL', 'BYTE', 'WORD', 'DWORD', 'LWORD',
            'SINT', 'INT', 'DINT', 'LINT',
            'USINT', 'UINT', 'UDINT', 'ULINT',
            'REAL', 'LREAL',
            'TIME', 'DATE', 'TIME_OF_DAY', 'TOD', 'DATE_AND_TIME', 'DT',
            'STRING', 'WSTRING',
            'ARRAY', 'OF',
        ],

        // --- ST operators used in TRANSITION conditions ---
        operators: [
            'AND', 'OR', 'XOR', 'NOT', 'MOD',
            'IF', 'THEN', 'ELSE', 'ELSIF', 'END_IF',
            'CASE', 'OF', 'END_CASE',
            'FOR', 'TO', 'BY', 'DO', 'END_FOR',
            'WHILE', 'END_WHILE', 'REPEAT', 'UNTIL', 'END_REPEAT',
            'RETURN', 'EXIT', 'CONTINUE',
            'VAR', 'END_VAR', 'VAR_INPUT', 'VAR_OUTPUT', 'VAR_IN_OUT',
            'RETAIN', 'CONSTANT', 'AT',
            'PROGRAM', 'FUNCTION', 'FUNCTION_BLOCK', 'END_PROGRAM',
            'END_FUNCTION', 'END_FUNCTION_BLOCK',
            // Standard IEC functions commonly used in transitions
            'TON', 'TOF', 'TP', 'CTU', 'CTD', 'CTUD',
            'ADD', 'SUB', 'MUL', 'DIV',
            'GT', 'GE', 'EQ', 'LE', 'LT', 'NE',
            'SEL', 'MAX', 'MIN', 'LIMIT', 'MUX',
            'ABS', 'SQRT', 'LN', 'LOG', 'EXP', 'SIN', 'COS', 'TAN',
            'ASIN', 'ACOS', 'ATAN', 'EXPT',
            'SHL', 'SHR', 'ROL', 'ROR',
        ],

        brackets: [
            { open: '{', close: '}', token: 'delimiter.curly' },
            { open: '[', close: ']', token: 'delimiter.square' },
            { open: '(', close: ')', token: 'delimiter.parenthesis' },
        ],

        tokenizer: {
            root: [
                // --- Comments: (* ... *) ---
                [/\(\*/, 'comment', '@comment'],

                // --- Action qualifiers at line start ---
                // Match P0, P1 first (multi-character), then single N/S/R/L/D/P
                [/^[ \t]*(P0|P1)\b/m, 'keyword.qualifier'],
                [/^[ \t]*[NSRLDP]\s/, 'keyword.qualifier'],

                // --- Bool constants ---
                [/\b(?:TRUE|FALSE)\b/, 'number'],

                // --- Time/Duration literals: T#5s, TIME#100ms, t#5s_100ms ---
                [/\b(?:TIME|T|t)#[\d.]+[dhms]+(?:_\d+[dhms]+)?\b/i, 'number'],

                // --- Date literals: D#2024-01-01, DATE#2024-01-01 ---
                [/\b(?:DATE|D|d)#\d{4}-\d{2}-\d{2}\b/i, 'number'],

                // --- Time of day: TOD#12:00:00, TIME_OF_DAY#12:00:00.123 ---
                [/\b(?:TOD|TIME_OF_DAY|tod|time_of_day)#\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?\b/i, 'number'],

                // --- Date and time: DT#2024-01-01-12:00:00 ---
                [/\b(?:DATE_AND_TIME|DT|dt)#\d{4}-\d{2}-\d{2}-\d{2}:\d{2}:\d{2}\b/i, 'number'],

                // --- Float numbers ---
                [/\d+\.\d+([eE][+-]?\d+)?/, 'number.float'],

                // --- Base-prefixed integers: 2#1010, 8#77, 16#FF ---
                [/\b(?:2|8|16)#[0-9A-Fa-f_]+/, 'number.hex'],

                // --- Plain integers ---
                [/\b\d+\b/, 'number'],

                // --- Single-quoted strings ---
                [/'([^'\\]|\\.)*$/, 'string.invalid'],
                [/'/, { token: 'string.quote', bracket: '@open', next: '@string' }],

                // --- Assignment operator (:=) before comparison (=) ---
                [/:=\b/, 'operator'],

                // --- Exponentiation operator ---
                [/\*\*/, 'operator'],

                // --- Comparison and arithmetic operators ---
                [/[=<>!]+/, 'operator'],
                [/[+\-*\/]/, 'operator'],

                // --- Delimiters ---
                [/;/, 'delimiter.semicolon'],
                [/:/, 'delimiter'],
                [/\.\./, 'operator'],  // range operator

                // --- Identifiers with keyword/type/operator case switching ---
                [/[a-zA-Z_][\w.]*/, {
                    cases: {
                        'typeKeywords': 'type',
                        'operators': 'keyword.operator',
                        'keywords': 'keyword',
                        '@default': 'identifier',
                    },
                }],

                // --- Brackets ---
                [/[{}()\[\]]/, '@brackets'],

                // --- Whitespace ---
                [/\s+/, 'white'],
            ],

            // --- Single-quoted string state ---
            string: [
                [/[^\\']+/, 'string'],
                [/\\./, 'string.escape'],
                [/'/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
            ],

            // --- IEC 61131-3 (* ... *) comment state ---
            comment: [
                [/[^*(]+/, 'comment'],
                [/\*\)/, 'comment', '@pop'],
                [/[(*]/, 'comment'],
            ],
        },
    };

    return language;
}
