"use strict";
/**
 * GVL global variable list pure model (A2-1).
 * Parses/serializes IEC 61131-3 `VAR_GLOBAL ... END_VAR` blocks.
 * Zero @theia dependency so it can be unit-tested without a DOM.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GVL_TYPES = void 0;
exports.parseGvl = parseGvl;
exports.serializeGvl = serializeGvl;
/** A2-3 type subset — the dropdown offered by the GVL table editor. */
exports.GVL_TYPES = ['BOOL', 'INT', 'REAL', 'TIME', 'STRING'];
/**
 * One GVL declaration line:
 *   name : TYPE := initialValue; (* comment *)
 * Init and comment are optional.
 */
const GVL_VAR_LINE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?::=\s*([^;]*?))?\s*;\s*(?:\(\*\s*([\s\S]*?)\s*\*\))?\s*$/;
/**
 * Extract the variables declared in a GVL file's `VAR_GLOBAL ... END_VAR`
 * block. Lines outside the block, blank lines, and whole-line comments are
 * ignored. Malformed declaration lines are skipped (lenient parse).
 */
function parseGvl(text) {
    const vars = [];
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
function serializeGvl(vars) {
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
//# sourceMappingURL=gvl-model.js.map