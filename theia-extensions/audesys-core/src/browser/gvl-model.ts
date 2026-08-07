/**
 * GVL global variable list pure model (A2-1).
 * Parses/serializes IEC 61131-3 `VAR_GLOBAL ... END_VAR` blocks.
 * Zero @theia dependency so it can be unit-tested without a DOM.
 */

export interface GvlVariable {
    name: string;
    type: string;
    init: string;
    comment: string;
}

/** A2-3 type subset — re-exported from the shared iec-types module for backward compat. */
export { IEC_TYPES as GVL_TYPES } from './iec-types';

/**
 * One GVL declaration line:
 *   name : TYPE := initialValue; (* comment *)
 * Init and comment are optional.
 */
export const GVL_VAR_LINE =
    /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?::=\s*([^;]*?))?\s*;\s*(?:\(\*\s*([\s\S]*?)\s*\*\))?\s*$/;

/**
 * Extract the variables declared in a GVL file's `VAR_GLOBAL ... END_VAR`
 * block. Lines outside the block, blank lines, and whole-line comments are
 * ignored. Malformed declaration lines are skipped (lenient parse).
 */
export function parseGvl(text: string): GvlVariable[] {
    const vars: GvlVariable[] = [];
    let inBlock = false;
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (line.startsWith('VAR_GLOBAL')) {
            inBlock = true;
            continue;
        }
        if (line.startsWith('END_VAR')) {
            inBlock = false;
            continue;
        }
        if (!inBlock || line === '' || line.startsWith('(*')) {
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
 * Serialize variables back into a `VAR_GLOBAL ... END_VAR` text block.
 * Init/comment omitted when empty. Round-trips through parseGvl.
 */
export function serializeGvl(vars: GvlVariable[]): string {
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
    return ['VAR_GLOBAL', ...rows, 'END_VAR', ''].join('\n');
}