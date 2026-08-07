"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCAL_TYPES = void 0;
exports.findFirstLocalVarBlock = findFirstLocalVarBlock;
exports.parseLocalVars = parseLocalVars;
exports.serializeLocalVars = serializeLocalVars;
/**
 * Local variable pure model (A2-2).
 * Parses/serializes the `VAR ... END_VAR` block of a ST/IL POU file.
 * Only the first plain `VAR` block (no suffix like VAR_INPUT/VAR_OUTPUT) is
 * handled — the POU's main local-variable region, matching the A1-4 template.
 * Zero @theia dependency so it can be unit-tested without a DOM.
 */
const gvl_model_1 = require("./gvl-model");
const iec_types_1 = require("./iec-types");
/** Reuse the A2-3 type subset from the shared iec-types module. */
exports.LOCAL_TYPES = iec_types_1.IEC_TYPES;
/**
 * Locate the first plain `VAR` block. `VAR` is matched exactly (not
 * VAR_INPUT/VAR_OUTPUT/VAR_TEMP/VAR_GLOBAL). Returns null when absent.
 */
function findFirstLocalVarBlock(text) {
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
function parseLocalVars(text) {
    const block = findFirstLocalVarBlock(text);
    if (!block) {
        return [];
    }
    const interior = text.split(/\r?\n/).slice(block.startLine + 1, block.endLine);
    const vars = [];
    for (const raw of interior) {
        const line = raw.trim();
        if (line === '' || line.startsWith('(*')) {
            continue;
        }
        const m = gvl_model_1.GVL_VAR_LINE.exec(line);
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
function serializeLocalVars(originalText, vars) {
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
//# sourceMappingURL=local-var-model.js.map