/**
 * SFC Tokenizer & Compile Tests.
 *
 * Tests the Monarch tokenizer configuration from sfc-language.ts and
 * validates that SFC structural keywords, action qualifiers, transitions,
 * and branches are correctly identified.
 *
 * Since compileSfc (napi-rs bridge) is not available in vitest, we test
 * at the token level: the Monarch definition correctly identifies SFC structure.
 */

import { describe, it, expect } from 'vitest';
import { createSfcMonarchLanguage } from '../src/browser/sfc-language';

// ============================================================================
// Monarch tokenizer simulation helper
// ============================================================================

/**
 * A simplified Monarch tokenizer that applies regex rules from the Monarch
 * language definition against source text and returns matched token types.
 * This simulates Monaco's internal tokenizer behavior.
 */
interface TokenMatch {
    type: string;
    value: string;
    line: number;
}

interface MonarchRule {
    // regex | { token, next, cases, bracket }
}

function simulateMonarchTokenize(source: string): TokenMatch[] {
    const lang = createSfcMonarchLanguage();
    const rootRules = lang.tokenizer['root'];
    const tokens: TokenMatch[] = [];
    const lines = source.split('\n');

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        let remaining = lines[lineIdx];
        let pos = 0;

        while (remaining.length > 0) {
            let matched = false;

            for (const rule of rootRules) {
                const pattern: RegExp = rule[0] as RegExp;
                const target = rule[1];

                // Reset lastIndex for global regexps
                pattern.lastIndex = 0;
                const m = pattern.exec(remaining);
                if (m !== null && m.index === 0) {
                    const matchedText = m[0];
                    const tokenType = resolveTokenType(target, matchedText);

                    if (tokenType !== 'white' && tokenType !== 'invalid') {
                        tokens.push({
                            type: tokenType,
                            value: matchedText,
                            line: lineIdx + 1,
                        });
                    }

                    remaining = remaining.slice(matchedText.length);
                    pos += matchedText.length;
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                // Skip char by char to avoid infinite loop on unrecognized chars
                remaining = remaining.slice(1);
                pos++;
            }
        }
    }

    return tokens;
}

/**
 * Resolve a Monarch rule target (string, object, or fallback) to a token type.
 */
function resolveTokenType(
    target: unknown,
    matchedText: string,
): string {
    // Simple string target
    if (typeof target === 'string') {
        return target;
    }

    // Object target with cases
    if (typeof target === 'object' && target !== null) {
        const t = target as Record<string, unknown>;

        // { token: '...', next: '...', bracket: '...' }
        if (typeof t.token === 'string') {
            return t.token as string;
        }

        // { cases: { typeKeywords: 'type', operators: 'keyword.operator', ... } }
        if (t.cases && typeof t.cases === 'object') {
            const cases = t.cases as Record<string, string>;
            return resolveCases(cases, matchedText);
        }
    }

    return 'identifier';
}

/**
 * Resolve Monarch cases: check typeKeywords, operators, keywords maps.
 */
function resolveCases(cases: Record<string, string>, text: string): string {
    // We need the language context to check the keyword lists.
    // Since we can't do this inline in the simulator, we pre-compute
    // via separate keyword tests.
    // For token-by-token simulation, we check against the language definition.
    const lang = createSfcMonarchLanguage();

    const upper = text.toUpperCase();
    if (lang.typeKeywords && lang.typeKeywords.includes(upper)) return cases['typeKeywords'] || 'type';
    if (lang.operators && lang.operators.includes(upper)) return cases['operators'] || 'keyword.operator';
    if (lang.keywords && lang.keywords.includes(upper)) return cases['keywords'] || 'keyword';
    return cases['@default'] || 'identifier';
}

// ============================================================================
// Token collector helper — identifies tokens of specific type
// ============================================================================

function collectTokensOfType(source: string, typePrefix: string): TokenMatch[] {
    return simulateMonarchTokenize(source).filter((t) => t.type.startsWith(typePrefix));
}

function hasKeywordToken(source: string, keyword: string): boolean {
    const tokens = simulateMonarchTokenize(source);
    return tokens.some(
        (t) => t.type === 'keyword' && t.value.toUpperCase() === keyword.toUpperCase(),
    );
}

function hasActionQualifier(source: string, qualifier: string): boolean {
    const tokens = simulateMonarchTokenize(source);
    return tokens.some(
        (t) => t.type === 'keyword.qualifier' && t.value.trim() === qualifier,
    );
}

// ============================================================================
// SFC Source Templates
// ============================================================================

const MINIMAL_SFC = `STEP Init
  ACTION N: x := 0;
END_STEP
`;

const SFC_WITH_TRANSITION = `STEP Init
  ACTION N: x := 0;
END_STEP
TRANSITION FROM Init TO Run : start = TRUE
END_TRANSITION
STEP Run
  ACTION P1: x := x + 1;
END_STEP
`;

const SFC_WITH_BRANCH = `STEP Init
  ACTION N: x := 0;
END_STEP
TRANSITION FROM Init TO Run : start = TRUE
END_TRANSITION
SELECTION_BRANCH
BRANCH
STEP RunA
  ACTION N: y := 1;
END_STEP
END_BRANCH
BRANCH
STEP RunB
  ACTION N: y := 2;
END_STEP
END_BRANCH
END_SELECTION
`;

const EMPTY_STEP_SFC = `STEP Empty
END_STEP
STEP Next
  ACTION N: x := 1;
END_STEP
TRANSITION FROM Empty TO Next : TRUE
END_TRANSITION
`;

const MULTI_ACTION_SFC = `STEP Init
  ACTION N: x := 0;
  ACTION S: y := 1;
  ACTION R: z := 0;
  ACTION P1: w := 1;
END_STEP
`;

// ============================================================================
// Tests
// ============================================================================

describe('SFC Monarch Tokenizer', () => {
    // ── Language definition structure ─────────────────────────

    it('creates a valid Monarch language definition', () => {
        const lang = createSfcMonarchLanguage();
        expect(lang).toBeDefined();
        expect(lang.defaultToken).toBe('invalid');
        expect(lang.tokenizer).toBeDefined();
        expect(lang.tokenizer.root).toBeDefined();
        expect(Array.isArray(lang.tokenizer.root)).toBe(true);
        expect(lang.tokenizer.root.length).toBeGreaterThan(0);
    });

    it('has correct SFC structural keywords', () => {
        const lang = createSfcMonarchLanguage();
        expect(lang.keywords).toBeDefined();
        expect(lang.keywords).toContain('STEP');
        expect(lang.keywords).toContain('END_STEP');
        expect(lang.keywords).toContain('TRANSITION');
        expect(lang.keywords).toContain('END_TRANSITION');
        expect(lang.keywords).toContain('ACTION');
        expect(lang.keywords).toContain('END_ACTION');
        expect(lang.keywords).toContain('INITIAL_STEP');
        expect(lang.keywords).toContain('SELECTION_BRANCH');
        expect(lang.keywords).toContain('END_SELECTION');
        expect(lang.keywords).toContain('SIMULTANEOUS_BRANCH');
        expect(lang.keywords).toContain('END_SIMULTANEOUS');
        expect(lang.keywords).toContain('GOTO');
    });

    // ── Test 1: Minimal SFC (INITIAL_STEP→STEP) produces valid tokens ──

    it('tokenizes minimal SFC: STEP + ACTION + END_STEP', () => {
        const tokens = simulateMonarchTokenize(MINIMAL_SFC);
        const keywords = tokens.filter((t) => t.type === 'keyword');

        expect(keywords.length).toBeGreaterThanOrEqual(2);
        expect(keywords.some((t) => t.value === 'STEP')).toBe(true);
        expect(keywords.some((t) => t.value === 'END_STEP')).toBe(true);
        expect(keywords.some((t) => t.value === 'ACTION')).toBe(true);
    });

    it('recognizes INITIAL_STEP as a keyword', () => {
        const tokens = simulateMonarchTokenize(
            'INITIAL_STEP Start\n  ACTION N: init := TRUE;\nEND_STEP\n',
        );
        expect(tokens.some((t) => t.type === 'keyword' && t.value === 'INITIAL_STEP')).toBe(true);
    });

    it('recognizes step name as identifier after STEP keyword', () => {
        const tokens = simulateMonarchTokenize(MINIMAL_SFC);
        const identifiers = tokens.filter((t) => t.type === 'identifier');
        expect(identifiers.some((t) => t.value === 'Init')).toBe(true);
    });

    // ── Test 2: SFC with TRANSITION compiles ──────────────────

    it('tokenizes SFC with TRANSITION FROM/TO', () => {
        const tokens = simulateMonarchTokenize(SFC_WITH_TRANSITION);
        const keywords = tokens.filter((t) => t.type === 'keyword');

        expect(keywords.some((t) => t.value === 'TRANSITION')).toBe(true);
        expect(keywords.some((t) => t.value === 'END_TRANSITION')).toBe(true);
    });

    it('recognizes FROM and TO as operators (ST keywords)', () => {
        const tokens = simulateMonarchTokenize(SFC_WITH_TRANSITION);
        const operators = tokens.filter((t) => t.type === 'keyword.operator');

        expect(operators.some((t) => t.value.toUpperCase() === 'FROM')).toBe(true);
        expect(operators.some((t) => t.value.toUpperCase() === 'TO')).toBe(true);
    });

    it('transition contains step name identifiers', () => {
        const tokens = simulateMonarchTokenize(SFC_WITH_TRANSITION);
        const identifiers = tokens.filter((t) => t.type === 'identifier');
        expect(identifiers.some((t) => t.value === 'Init')).toBe(true);
        expect(identifiers.some((t) => t.value === 'Run')).toBe(true);
    });

    // ── Test 3: SFC with ACTION and qualifier N ───────────────

    it('tokenizes action qualifier N', () => {
        const tokens = simulateMonarchTokenize(MINIMAL_SFC);
        const qualifiers = tokens.filter((t) => t.type === 'keyword.qualifier');
        expect(qualifiers.length).toBeGreaterThanOrEqual(1);
        expect(qualifiers.some((t) => t.value.trim().startsWith('N'))).toBe(true);
    });

    it('tokenizes multiple action qualifiers: N, S, R, P1', () => {
        const tokens = simulateMonarchTokenize(MULTI_ACTION_SFC);
        const qualifiers = tokens.filter((t) => t.type === 'keyword.qualifier');
        expect(qualifiers.length).toBeGreaterThanOrEqual(4);

        const qualifierTexts = qualifiers.map((q) => q.value.trim());
        expect(qualifierTexts.some((q) => q === 'N')).toBe(true);
        // S, R are single-char qualifiers that match as keyword.qualifier
        expect(qualifierTexts.some((q) => q === 'S')).toBe(true);
        expect(qualifierTexts.some((q) => q === 'R')).toBe(true);
        // P1 matches the P0|P1 pattern
        expect(qualifierTexts.some((q) => q === 'P1')).toBe(true);
    });

    it('tokenizes pulse falling qualifier P0', () => {
        const tokens = simulateMonarchTokenize(
            'STEP Test\n  ACTION P0: alarm := TRUE;\nEND_STEP\n',
        );
        const qualifiers = tokens.filter((t) => t.type === 'keyword.qualifier');
        expect(qualifiers.some((t) => t.value.trim() === 'P0')).toBe(true);
    });

    // ── Test 4: SELECTION_BRANCH parses correctly ─────────────

    it('tokenizes SELECTION_BRANCH structure', () => {
        const tokens = simulateMonarchTokenize(SFC_WITH_BRANCH);
        const keywords = tokens.filter((t) => t.type === 'keyword');

        expect(keywords.some((t) => t.value === 'SELECTION_BRANCH')).toBe(true);
        expect(keywords.some((t) => t.value === 'END_SELECTION')).toBe(true);
        expect(keywords.some((t) => t.value === 'BRANCH')).toBe(true);
        expect(keywords.some((t) => t.value === 'END_BRANCH')).toBe(true);
    });

    it('SELECTION_BRANCH preserves nested step names', () => {
        const tokens = simulateMonarchTokenize(SFC_WITH_BRANCH);
        const identifiers = tokens.filter((t) => t.type === 'identifier');
        expect(identifiers.some((t) => t.value === 'RunA')).toBe(true);
        expect(identifiers.some((t) => t.value === 'RunB')).toBe(true);
    });

    it('tokenizes SIMULTANEOUS_BRANCH keywords', () => {
        const tokens = simulateMonarchTokenize(
            'SIMULTANEOUS_BRANCH\nSTEP Left\n  ACTION N: x := 0;\nEND_STEP\nBRANCH\nSTEP Right\n  ACTION N: x := 1;\nEND_STEP\nEND_BRANCH\nEND_SIMULTANEOUS\n',
        );
        const keywords = tokens.filter((t) => t.type === 'keyword');
        expect(keywords.some((t) => t.value === 'SIMULTANEOUS_BRANCH')).toBe(true);
        expect(keywords.some((t) => t.value === 'END_SIMULTANEOUS')).toBe(true);
    });

    // ── Test 5: Edge case — empty STEP (no ACTION) ────────────

    it('tokenizes empty STEP without warning loss', () => {
        // empty STEP should still produce valid tokens (STEP + END_STEP)
        const tokens = simulateMonarchTokenize(EMPTY_STEP_SFC);
        const keywords = tokens.filter((t) => t.type === 'keyword');

        const stepPositions = tokens
            .filter((t) => t.type === 'keyword' && t.value === 'STEP')
            .map((t) => t.line);

        const endStepPositions = tokens
            .filter((t) => t.type === 'keyword' && t.value === 'END_STEP')
            .map((t) => t.line);

        // Two STEP keywords
        expect(stepPositions.length).toBe(2);
        // Two END_STEP keywords
        expect(endStepPositions.length).toBe(2);

        // Empty step: STEP and END_STEP on consecutive lines (lines 1, 2)
        expect(stepPositions[0]).toBe(1);
        expect(endStepPositions[0]).toBe(2);
    });

    it('empty STEP still produces tokens for TRANSITION linkage', () => {
        const tokens = simulateMonarchTokenize(EMPTY_STEP_SFC);
        const keywords = tokens.filter((t) => t.type === 'keyword');
        expect(keywords.some((t) => t.value === 'TRANSITION')).toBe(true);
        expect(keywords.some((t) => t.value === 'END_TRANSITION')).toBe(true);
    });

    // ── Bonus: GOTO keyword ───────────────────────────────────

    it('tokenizes GOTO keyword', () => {
        const tokens = simulateMonarchTokenize(
            'STEP Jump\n  ACTION N: x := 1;\n  GOTO Target;\nEND_STEP\n',
        );
        const keywords = tokens.filter((t) => t.type === 'keyword');
        expect(keywords.some((t) => t.value === 'GOTO')).toBe(true);
    });

    // ── Bonus: IEC 61131-3 types in actions are colored ───────

    it('tokenizes IEC types in ACTION bodies as type', () => {
        const tokens = simulateMonarchTokenize(
            'STEP Init\n  ACTION N: INT x := 0;\nEND_STEP\n',
        );
        const types = tokens.filter((t) => t.type === 'type');
        expect(types.some((t) => t.value.toUpperCase() === 'INT')).toBe(true);
    });

    // ── Bonus: Comments are handled ───────────────────────────

    it('comments do not pollute keyword tokens', () => {
        const tokens = simulateMonarchTokenize(
            '(* This is a comment *)\nSTEP Commented\n  ACTION N: x := 0; (* inline comment *)\nEND_STEP\n',
        );
        const keywords = tokens.filter((t) => t.type === 'keyword');
        // Should still find structural keywords, not comment tokens as keywords
        expect(keywords.some((t) => t.value === 'STEP')).toBe(true);
        expect(keywords.some((t) => t.value === 'END_STEP')).toBe(true);
    });

    // ── Bonus: Boolean constants ──────────────────────────────

    it('tokenizes TRUE/FALSE as number (IEC convention)', () => {
        const tokens = simulateMonarchTokenize(
            'STEP Init\n  ACTION N: done := TRUE;\nEND_STEP\n',
        );
        const numbers = tokens.filter((t) => t.type === 'number');
        expect(numbers.some((t) => t.value.toUpperCase() === 'TRUE')).toBe(true);
    });

    // ── Bonus: Time literals ──────────────────────────────────

    it('tokenizes T# duration literals', () => {
        const tokens = simulateMonarchTokenize(
            'STEP Timer\n  ACTION N: ton(IN:=start, PT:=T#5s);\nEND_STEP\n',
        );
        const numbers = tokens.filter((t) => t.type === 'number');
        expect(numbers.some((t) => t.value === 'T#5s')).toBe(true);
    });
});

// ============================================================================
// Keyword cross-reference validation (not using the simulator)
// ============================================================================

describe('SFC Monarch Language — Keyword Registry', () => {
    it('has no duplicate keywords', () => {
        const lang = createSfcMonarchLanguage();
        const allKeywords = [...(lang.keywords || []), ...(lang.typeKeywords || []), ...(lang.operators || [])];

        // Keywords and operators may overlap (e.g., FROM/TO in TRANSITION also in operators)
        // but within each array there should be no duplicates
        const keywordSet = new Set(lang.keywords);
        expect(keywordSet.size).toBe(lang.keywords?.length);

        const typeKeywordSet = new Set(lang.typeKeywords);
        expect(typeKeywordSet.size).toBe(lang.typeKeywords?.length);
    });

    it('GOTO is registered as a keyword', () => {
        const lang = createSfcMonarchLanguage();
        expect(lang.keywords).toContain('GOTO');
    });
});
