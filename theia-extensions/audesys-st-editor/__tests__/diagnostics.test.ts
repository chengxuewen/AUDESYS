/**
 * T2b.3t ST Monarch Diagnostic Mapping Tests
 *
 * Tests the Monarch tokenizer for IEC 61131-3 Structured Text.
 * Uses a minimal tokenizer simulator from the language definition.
 */

import { describe, expect, test } from 'vitest';
import { createStMonarchLanguage, MonarchLanguage } from '../src/browser/st-language';

// ── Minimal Monarch tokenizer simulator ──────────────────────────────────
// Processes lines through a Monarch language definition without requiring
// the full Monaco editor. Handles root state only.

interface Token {
    text: string;
    type: string;
}

function tokenize(language: MonarchLanguage, line: string): Token[] {
    return tokenizeState(language, line, 'root');
}

function tokenizeState(
    language: MonarchLanguage,
    line: string,
    initialState: string,
): Token[] {
    const rules = language.tokenizer[initialState];
    if (!rules) return [];

    const tokens: Token[] = [];
    let pos = 0;

    while (pos < line.length) {
        let matched = false;
        for (const rule of rules) {
            const [pattern, action] = rule as [RegExp, unknown];
            if (!(pattern instanceof RegExp)) continue;

            const remainder = line.slice(pos);
            const m = remainder.match(pattern);
            if (!m || m.index !== 0) continue;

            const text = m[0];
            pos += text.length;

            // Handle action: can be string, object with next/cases/bracket, or array
            if (typeof action === 'string') {
                tokens.push({ text, type: action });
            } else if (typeof action === 'object' && action !== null) {
                const obj = action as Record<string, unknown>;
                if (typeof obj.cases === 'object' && obj.cases !== null) {
                    // cases-based dispatch (keywords / types / identifiers)
                    const cases = obj.cases as Record<string, string>;
                    const kw = language.keywords ?? [];
                    const tk = language.typeKeywords ?? [];
                    if (tk.includes(text)) {
                        tokens.push({ text, type: 'type' });
                    } else if (kw.includes(text)) {
                        tokens.push({ text, type: 'keyword' });
                    } else {
                        tokens.push({ text, type: cases['@default'] ?? 'identifier' });
                    }
                } else if (typeof obj.token === 'string') {
                    // bracket open/close or string.quote with state switch
                    if (typeof obj.bracket === 'string' && typeof obj.next === 'string') {
                        tokens.push({ text, type: obj.token });
                        // Enter nested state — recursively tokenize rest
                        const restTokens = tokenizeState(language, line.slice(pos), obj.next.slice(1));
                        tokens.push(...restTokens);
                        pos = line.length; // consumed rest of line
                    } else {
                        tokens.push({ text, type: obj.token });
                    }
                } else {
                    tokens.push({ text, type: 'unknown' });
                }
            } else {
                tokens.push({ text, type: 'unknown' });
            }

            matched = true;
            break;
        }

        if (!matched) {
            // Unmatched character: skip it
            pos++;
        }
    }

    return tokens;
}

function tokenTypes(tokens: Token[]): string[] {
    return tokens.map(t => t.type);
}

function hasTokenType(tokens: Token[], type: string): boolean {
    return tokens.some(t => t.type === type);
}

// ── Language instance (shared across tests) ──────────────────────────────
const language = createStMonarchLanguage();

// ── Tests ────────────────────────────────────────────────────────────────

describe('ST Monarch Tokenizer', () => {
    // Test 1: Keywords (spot-check 20 key ones)
    describe('keyword highlighting', () => {
        const keyWords = [
            'PROGRAM', 'END_PROGRAM', 'FUNCTION', 'FUNCTION_BLOCK', 'END_FUNCTION_BLOCK',
            'IF', 'THEN', 'ELSE', 'ELSIF', 'END_IF',
            'FOR', 'TO', 'BY', 'DO', 'END_FOR',
            'WHILE', 'END_WHILE', 'REPEAT', 'UNTIL', 'END_REPEAT',
            'CASE', 'END_CASE', 'RETURN', 'EXIT', 'CONTINUE',
            'VAR', 'END_VAR', 'VAR_INPUT', 'VAR_OUTPUT', 'VAR_GLOBAL',
            'STRUCT', 'END_STRUCT', 'ARRAY', 'OF', 'CONSTANT',
            'TRUE', 'FALSE', 'NULL',
            'NOT', 'AND', 'OR', 'XOR', 'MOD',
            'TYPE', 'END_TYPE', 'METHOD', 'PROPERTY', 'INTERFACE',
            'SUPER', 'THIS', 'ACTION', 'TRANSITION',
            'RET', 'RETC', 'RETCN', 'S', 'R',
        ];

        for (const kw of keyWords) {
            test(`keyword "${kw}"`, () => {
                const tokens = tokenize(language, kw);
                expect(tokenTypes(tokens)).toContain('keyword');
            });
        }
    });

    // Test 2: (* ... *) block comments
    test('(* ... *) block comments', () => {
        const tokens = tokenize(language, '(* this is a block comment *)');
        // Should be comment tokens, not identifier/keyword
        expect(tokens.length).toBeGreaterThan(0);
        for (const t of tokens) {
            expect(t.type).toBe('comment');
        }
    });

    test('(* block comment with IF THEN inside still comment', () => {
        const tokens = tokenize(language, '(* IF THEN ELSE END_IF *)');
        for (const t of tokens) {
            expect(t.type).toBe('comment');
        }
    });

    test('(* block comment is not closed by (', () => {
        const tokens = tokenize(language, '(* open paren ( still comment *)');
        for (const t of tokens) {
            expect(t.type).toBe('comment');
        }
    });

    // Test 3: // line comments
    test('// line comments', () => {
        const tokens = tokenize(language, '// this is a line comment');
        expect(tokens.length).toBe(1);
        expect(tokens[0].type).toBe('comment');
    });

    test('// line comment after code', () => {
        // The comment part should be tokenized as comment
        const tokens = tokenize(language, 'x := 1 // trailing comment');
        expect(tokens.some(t => t.type === 'comment')).toBe(true);
    });

    // Test 4: Types highlighted as type
    describe('type highlighting', () => {
        const iecTypes = [
            'BOOL', 'BYTE', 'WORD', 'DWORD', 'LWORD',
            'SINT', 'INT', 'DINT', 'LINT',
            'USINT', 'UINT', 'UDINT', 'ULINT',
            'REAL', 'LREAL',
            'TIME', 'LTIME', 'DATE', 'LDATE',
            'TIME_OF_DAY', 'TOD', 'DATE_AND_TIME', 'DT',
            'STRING', 'WSTRING',
            'ANY', 'ANY_NUM', 'ANY_REAL', 'ANY_BIT', 'ANY_STRING', 'ANY_DATE',
        ];

        for (const t of iecTypes) {
            test(`type "${t}"`, () => {
                const tokens = tokenize(language, t);
                expect(tokenTypes(tokens)).toContain('type');
            });
        }
    });

    // Verify that user-defined type names (not in list) are identifiers
    test('custom name NOT highlighted as type', () => {
        const tokens = tokenize(language, 'MyCustomType');
        expect(tokenTypes(tokens)).toContain('identifier');
        expect(hasTokenType(tokens, 'type')).toBe(false);
    });

    // Test 5: Time literals
    test('time literals: T#1s', () => {
        const tokens = tokenize(language, 'T#1s');
        expect(tokenTypes(tokens)).toContain('number');
    });

    test('time literals: TIME#5m30s', () => {
        const tokens = tokenize(language, 'TIME#5m30s');
        expect(tokenTypes(tokens)).toContain('number');
    });

    test('date literals: D#2021-01-01', () => {
        const tokens = tokenize(language, 'D#2021-01-01');
        expect(tokenTypes(tokens)).toContain('number');
    });

    test('TOD literal: TOD#12:00:00', () => {
        const tokens = tokenize(language, 'TOD#12:00:00');
        expect(tokenTypes(tokens)).toContain('number');
    });

    // Test 6: String literals
    test("single-quoted string: 'hello world'", () => {
        const tokens = tokenize(language, "'hello world'");
        expect(tokens.some(t => t.type === 'string.quote' || t.type === 'string')).toBe(true);
    });

    test('double-quoted string: "hello"', () => {
        const tokens = tokenize(language, '"hello"');
        expect(tokens.some(t => t.type === 'string.quote' || t.type === 'string')).toBe(true);
    });

    test('string with escape: $N within string', () => {
        const tokens = tokenize(language, "'line1$Nline2'");
        expect(tokens.some(t => t.type === 'string.escape')).toBe(true);
    });

    test('string with double dollar escape: $$', () => {
        const tokens = tokenize(language, "'cost $$100'");
        expect(tokens.some(t => t.type === 'string.escape')).toBe(true);
    });

    // Test 7: Variables not confused with keywords
    test('myVariable is identifier, not keyword', () => {
        const tokens = tokenize(language, 'myVariable');
        expect(tokenTypes(tokens)).toContain('identifier');
        expect(hasTokenType(tokens, 'keyword')).toBe(false);
    });

    test('programmer is identifier (not PROGRAM keyword)', () => {
        const tokens = tokenize(language, 'programmer');
        expect(tokenTypes(tokens)).toContain('identifier');
        expect(hasTokenType(tokens, 'keyword')).toBe(false);
    });

    test('return_value is identifier (not RETURN keyword)', () => {
        const tokens = tokenize(language, 'return_value');
        expect(tokenTypes(tokens)).toContain('identifier');
        expect(hasTokenType(tokens, 'keyword')).toBe(false);
    });

    test('x is identifier, not keyword', () => {
        const tokens = tokenize(language, 'x');
        expect(tokenTypes(tokens)).toContain('identifier');
    });

    // Test 8: Operators
    test('assignment :=', () => {
        const tokens = tokenize(language, ':=');
        expect(tokenTypes(tokens)).toContain('operator');
    });

    test('fat arrow =>', () => {
        const tokens = tokenize(language, '=>');
        expect(tokenTypes(tokens)).toContain('operator');
    });

    test('range ..', () => {
        const tokens = tokenize(language, '..');
        expect(tokenTypes(tokens)).toContain('operator');
    });

    test('not equal <>', () => {
        const tokens = tokenize(language, '<>');
        expect(tokenTypes(tokens)).toContain('operator');
    });

    test('less-or-equal <=', () => {
        const tokens = tokenize(language, '<=');
        expect(tokenTypes(tokens)).toContain('operator');
    });

    test('greater-or-equal >=', () => {
        const tokens = tokenize(language, '>=');
        expect(tokenTypes(tokens)).toContain('operator');
    });

    test('exponent **', () => {
        const tokens = tokenize(language, '**');
        expect(tokenTypes(tokens)).toContain('operator');
    });

    test('simple plus operator', () => {
        const tokens = tokenize(language, '+');
        expect(tokenTypes(tokens)).toContain('operator');
    });

    // Bonus: full line tokenization
    test('full line: IF x <= 10 THEN (* check *) y := TRUE; END_IF', () => {
        const tokens = tokenize(language, 'IF x <= 10 THEN (* check *) y := TRUE; END_IF');
        const types = tokenTypes(tokens);
        expect(types).toContain('keyword'); // IF, THEN, TRUE, END_IF
        expect(types).toContain('operator'); // <=, :=
        expect(types).toContain('comment'); // (* check *)
        expect(types).toContain('identifier'); // x, y
    });

    // Verify defaultToken for unmatched input
    test('defaultToken is invalid', () => {
        expect(language.defaultToken).toBe('invalid');
    });

    // Verify brackets are defined
    test('brackets are defined', () => {
        expect(language.brackets?.length).toBe(3);
    });

    // Hex numbers
    test('hex literal 16#FF', () => {
        const tokens = tokenize(language, '16#FF');
        expect(tokenTypes(tokens)).toContain('number.hex');
    });

    // Float numbers
    test('float literal 3.14', () => {
        const tokens = tokenize(language, '3.14');
        expect(tokenTypes(tokens)).toContain('number.float');
    });

    // Integer numbers
    test('integer literal 42', () => {
        const tokens = tokenize(language, '42');
        expect(tokenTypes(tokens)).toContain('number');
    });
});
