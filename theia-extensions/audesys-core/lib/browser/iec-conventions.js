"use strict";
/**
 * IEC 61131-3 directory-convention helpers (D113).
 * Pure, dependency-free module so it can be unit-tested without pulling in
 * @theia (which needs a DOM). Shared by the new-file command and the POU tree
 * view (A1-2).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IEC_LANG_DIR = void 0;
exports.nextFileName = nextFileName;
/**
 * Directory-convention mapping: language extension → subdirectory name under
 * the workspace root. Falling back to the root means a `.gvl`/unknown ext
 * still resolves predictably.
 */
exports.IEC_LANG_DIR = {
    '.st': 'Programs',
    '.il': 'Programs',
    '.ld': 'Programs',
    '.fbd': 'Programs',
    '.sfc': 'Programs',
    '.gvl': 'GVL',
    '.hmi': 'Hmi',
    '.gcode': 'Cnc',
};
/**
 * Compute the next available filename inside a directory, auto-incrementing
 * when the plain name is already taken: untitled.st → untitled-1.st → ...
 */
function nextFileName(isTaken, ext, base = 'untitled') {
    let counter = 0;
    for (;;) {
        const name = counter === 0 ? `${base}${ext}` : `${base}-${counter}${ext}`;
        if (!isTaken(name)) {
            return name;
        }
        counter++;
    }
}
//# sourceMappingURL=iec-conventions.js.map