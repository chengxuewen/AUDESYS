/**
 * Variable-reference recognition pure model (A2-4).
 *
 * Extracts the identifier references used in a ST POU body and compares them
 * against the variables declared in the local `VAR ... END_VAR` block, so the
 * variable-table view can flag "code references but never declared" names.
 *
 * This is pure text analysis — it does NOT run the ST compiler (that is A4).
 * It is intentionally conservative: a name listed here may be a real lost
 * declaration, an engine built-in, or a global; the view treats it as a hint.
 * Zero @theia dependency so it can be unit-tested without a DOM.
 */

import { findFirstLocalVarBlock } from './local-var-model';

/** IEC 61131-3 ST keywords that are never variable references. */
const KEYWORDS = new Set<string>([
    'PROGRAM', 'END_PROGRAM', 'FUNCTION', 'END_FUNCTION', 'FUNCTION_BLOCK',
    'END_FUNCTION_BLOCK', 'METHOD', 'END_METHOD', 'VAR', 'END_VAR',
    'VAR_INPUT', 'VAR_OUTPUT', 'VAR_IN_OUT', 'VAR_TEMP', 'VAR_GLOBAL',
    'VAR_EXTERNAL', 'VAR_ACCESS', 'VAR_CONFIG', 'IF', 'THEN', 'ELSE',
    'ELSIF', 'ELSEIF', 'END_IF', 'CASE', 'OF', 'END_CASE', 'FOR', 'TO',
    'BY', 'DO', 'END_FOR', 'WHILE', 'END_WHILE', 'REPEAT', 'UNTIL',
    'END_REPEAT', 'RETURN', 'EXIT', 'NOT', 'AND', 'OR', 'XOR', 'MOD',
    'AND_THEN', 'OR_ELSE', 'TRUE', 'FALSE', 'GOTO', 'TYPE', 'END_TYPE',
    'STRUCT', 'END_STRUCT', 'ARRAY', 'UNION', 'END_UNION', 'INTERFACE',
    'END_INTERFACE', 'IMPLEMENTS', 'EXTENDS', 'CONSTANT', 'RETAIN',
    'NON_RETAIN', 'AT', 'BY_REF', 'BY_VALUE', 'REF', 'REFERENCE', 'THIS',
    'SUPER', 'SELF', 'NULL', 'STEP', 'END_STEP', 'TRANSITION',
    'END_TRANSITION', 'INITIAL_STEP', 'ACTION', 'END_ACTION',
    // IEC base types (used as type names, not variable references).
    'BOOL', 'BYTE', 'WORD', 'DWORD', 'LWORD', 'SINT', 'INT', 'DINT', 'LINT',
    'USINT', 'UINT', 'UDINT', 'ULINT', 'REAL', 'LREAL', 'TIME', 'DATE',
    'TOD', 'DT', 'TIME_OF_DAY', 'DATE_AND_TIME', 'STRING', 'WSTRING',
    'CHAR', 'WCHAR', 'ENUM', 'TIME_ADAPT',
]);

/** ST single-quoted string literal; `''` is an escaped quote. */
const STRING_LITERAL = /'(?:[^']|'')*'/g;
/** ST `(* ... *)` comment (non-nested is fine for a hint feature). */
const BLOCK_COMMENT = /\(\*[\s\S]*?\*\)/g;
/** A `T#2s` / `TIME#5s` / `D#2026-01-01` time literal. */
const TIME_LITERAL = /\b(?:T|TIME|D|DATE|TOD|DT|DATE_AND_TIME)#[^\s;]*/g;
/** An IEC identifier token. */
const IDENTIFIER = /[A-Za-z_][A-Za-z0-9_]*/g;

/**
 * Extract the ST POU body — the statement region between the end of the first
 * local `VAR` block and `END_PROGRAM`. When there is no `VAR` block, the body
 * starts after the `PROGRAM <name>` header line. Everything before/after is
 * excluded so declaration names and headers do not count as references.
 */
export function extractProgramBody(text: string): string {
    const lines = text.split(/\r?\n/);
    let start = 0;
    const block = findFirstLocalVarBlock(text);
    if (block) {
        start = block.endLine + 1;
    } else {
        const progIdx = lines.findIndex((l) => /^\s*PROGRAM\b/i.test(l.trim()));
        if (progIdx >= 0) {
            start = progIdx + 1;
        }
    }
    const endIdx = lines.findIndex((l, i) => i >= start && /^\s*END_PROGRAM\b/i.test(l.trim()));
    const end = endIdx >= 0 ? endIdx : lines.length;
    return lines.slice(start, end).join('\n');
}

/**
 * Extract the identifier references used in a ST POU body (the `code` returned
 * by {@link extractProgramBody}). String literals and comments are stripped
 * first; keywords and base types are filtered out. Returns unique names in
 * first-appearance order. This is intentionally conservative — it is a hint
 * source for the variable-table view, not a compiler diagnostic.
 */
export function extractVarReferences(code: string): string[] {
    const cleaned = code
        .replace(STRING_LITERAL, '')
        .replace(BLOCK_COMMENT, '')
        .replace(TIME_LITERAL, '');
    const seen = new Set<string>();
    const refs: string[] = [];
    let m: RegExpExecArray | null;
    IDENTIFIER.lastIndex = 0;
    while ((m = IDENTIFIER.exec(cleaned)) !== null) {
        const name = m[0];
        if (KEYWORDS.has(name)) {
            continue;
        }
        if (!seen.has(name)) {
            seen.add(name);
            refs.push(name);
        }
    }
    return refs;
}

/**
 * Names referenced in the ST body but NOT declared in the local `VAR` block.
 * Unique, in first-appearance order. Empty declared list returns every
 * reference (all are undeclared). Intended as a hint for the variable table.
 */
export function findUndeclaredRefs(code: string, declaredVarNames: string[]): string[] {
    const declared = new Set(declaredVarNames);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const ref of extractVarReferences(code)) {
        if (!declared.has(ref) && !seen.has(ref)) {
            seen.add(ref);
            out.push(ref);
        }
    }
    return out;
}