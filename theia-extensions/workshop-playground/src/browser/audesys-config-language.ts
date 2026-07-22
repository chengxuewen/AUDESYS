/**
 * Monarch tokenizer for the "AUDESYS Config" mini-language (.audesys files).
 *
 * This is a LEARNING EXERCISE — not a production language definition.
 * Demonstrates: keyword highlighting, comments, strings, numbers, bracket matching.
 *
 * Language features:
 *   - device, signal, channel, controller, hal – top-level keywords
 *   - String literals with escape sequences
 *   - Single-line (#) and multi-line (### ... ###) comments
 *   - Integer and float numbers
 *   - Bracket/brace matching
 *
 * NOTE: This module does NOT import from monaco-editor directly.
 * It uses locally-defined types for self-containment. In production,
 * the types would come from @theia/monaco's Monaco interfaces.
 */

/**
 * Simplified Monarch tokenizer rule types.
 * Avoids direct monaco-editor dependency for this workshop exercise.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MonarchRule = any[];  // [RegExp, token] | [RegExp, token, nextState] | [RegExp, {token, ...}]

type MonarchRuleAtom = RegExp | {
    token: string;
    next?: string;
    bracket?: string;
    cases?: Record<string, string>;
};

interface MonarchLanguage {
    defaultToken: string;
    ignoreCase?: boolean;
    keywords?: string[];
    typeKeywords?: string[];
    brackets?: Array<{ open: string; close: string; token: string }>;
    tokenizer: Record<string, MonarchRule[]>;
}

/**
 * Create a Monarch language definition for "AUDESYS Config".
 *
 * Returns a plain object compatible with:
 *   monaco.languages.setMonarchTokensProvider('audesys-config', tokens);
 *
 * In a production Theia extension, this would be registered in
 * a MonacoContribution or FrontendApplicationContribution.
 */
export function createAudESYSConfigMonarchLanguage(): MonarchLanguage {
    const language: MonarchLanguage = {
        defaultToken: 'invalid',

        keywords: [
            'device', 'signal', 'channel', 'controller', 'hal',
            'bind', 'connect', 'expose', 'map', 'publish', 'subscribe',
            'deadline', 'liveliness', 'security_domain', 'queue_size',
        ],

        typeKeywords: [
            'Bool', 'S8', 'U8', 'S16', 'U16', 'S32', 'U32', 'F32', 'F64',
            'String', 'Blob',
        ],

        brackets: [
            { open: '{', close: '}', token: 'delimiter.curly' },
            { open: '[', close: ']', token: 'delimiter.square' },
            { open: '(', close: ')', token: 'delimiter.parenthesis' },
        ],

        tokenizer: {
            root: [
                [/###/, 'comment', '@commentBlock'],
                [/#.*$/, 'comment'],
                [/"([^"\\]|\\.)*$/, 'string.invalid'],
                [/^"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
                [/"$/, { token: 'string.quote', bracket: '@open', next: '@string' }],
                [/\d+\.\d+([eE][+-]?\d+)?/, 'number.float'],
                [/\d+/, 'number'],
                [/[a-zA-Z_]\w*/, {
                    cases: {
                        'typeKeywords': 'type',
                        'keywords': 'keyword',
                        '@default': 'identifier',
                    },
                }],
                [/[{}()\[\]]/, '@brackets'],
                [/[,;]/, 'delimiter'],
                [/\s+/, 'white'],
                [/[=<>!]+/, 'operator'],
                [/\./, 'delimiter'],
                [/:/, 'delimiter'],
            ],

            string: [
                [/[^\\"]+/, 'string'],
                [/\\./, 'string.escape'],
                [/^"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
            ],

            commentBlock: [
                [/[^#]+/, 'comment'],
                [/###/, 'comment', '@pop'],
                [/#/, 'comment'],
            ],
        },
    };

    return language;
}
