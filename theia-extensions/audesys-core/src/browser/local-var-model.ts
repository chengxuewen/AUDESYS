/**
 * Local variable pure model (A2-2).
 * Parses/serializes the `VAR ... END_VAR` block of a ST/IL POU file.
 * Only the first plain `VAR` block (no suffix like VAR_INPUT/VAR_OUTPUT) is
 * handled — the POU's main local-variable region, matching the A1-4 template.
 * Zero @theia dependency so it can be unit-tested without a DOM.
 */
import { GvlVariable, GVL_VAR_LINE } from './gvl-model';
import { IEC_TYPES } from './iec-types';

/** A local var shares the GVL shape (name/type/init/comment). */
export type LocalVariable = GvlVariable;

/** Reuse the A2-3 type subset from the shared iec-types module. */
export const LOCAL_TYPES: Readonly<string[]> = IEC_TYPES;

/** Line indices (0-based) of a `VAR ... END_VAR` block in the source text. */
export interface VarBlockRange {
    /** Index of the `VAR` line. */
    startLine: number;
    /** Index of the matching `END_VAR` line. */
    endLine: number;
}

/**
 * Locate the first plain `VAR` block. `VAR` is matched exactly (not
 * VAR_INPUT/VAR_OUTPUT/VAR_TEMP/VAR_GLOBAL). Returns null when absent.
 */
export function findFirstLocalVarBlock(text: string): VarBlockRange | null {
    const lines = text.split(/\r?\n/);
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === 'VAR') {
            start = i;
            break;
        }
    }
    if (start < 0) {
        return null;
    }
    for (let j = start + 1; j < lines.length; j++) {
        if (lines[j].trim() === 'END_VAR') {
            return { startLine: start, endLine: j };
        }
    }
    return null;
}

/**
 * Extract the variables declared inside the first `VAR ... END_VAR` block.
 * Lines outside the block, blank lines, and whole-line comments are ignored.
 * Malformed declaration lines are skipped (lenient parse).
 */
export function parseLocalVars(text: string): LocalVariable[] {
    const block = findFirstLocalVarBlock(text);
    if (!block) {
        return [];
    }
    const interior = text.split(/\r?\n/).slice(block.startLine + 1, block.endLine);
    const vars: LocalVariable[] = [];
    for (const raw of interior) {
        const line = raw.trim();
        if (line === '' || line.startsWith('(*')) {
            continue;
        }
        const m = GVL_VAR_LINE.exec(line);
        if (m) {
            vars.push({
                name: m[1],
                type: m[2],
                init: (m[3] ?? '').trim(),
                comment: (m[4] ?? '').trim(),
            });
        }
    }
    return vars;
}

/**
 * Serialize variables back into the FIRST `VAR ... END_VAR` block of the
 * original text, preserving everything else (PROGRAM/END_PROGRAM headers,
 * statements, other VAR blocks). The `VAR`/`END_VAR` lines keep their
 * original indentation. Round-trips through parseLocalVars.
 *
 * Returns the original text unchanged when the file has no `VAR` block.
 */
export function serializeLocalVars(originalText: string, vars: LocalVariable[]): string {
    const block = findFirstLocalVarBlock(originalText);
    if (!block) {
        return originalText;
    }
    const lines = originalText.split(/\r?\n/);
    const eol = originalText.includes('\r\n') ? '\r\n' : '\n';
    const rows = vars.map((v) => {
        let line = `    ${v.name} : ${v.type}`;
        if (v.init) {
            line += ` := ${v.init}`;
        }
        line += ';';
        if (v.comment) {
            line += ` (* ${v.comment} *)`;
        }
        return line;
    });
    const head = lines.slice(0, block.startLine + 1);
    const tail = lines.slice(block.endLine);
    return [...head, ...rows, ...tail].join(eol);
}