"use strict";
/**
 * POU wizard pure model (A1-4).
 * Maps a POU type + programming language → { directory, extension, template }.
 * Zero @theia dependency so it can be unit-tested without a DOM.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.POU_TYPES = void 0;
exports.languagesFor = languagesFor;
exports.validatePouName = validatePouName;
exports.pouTarget = pouTarget;
exports.POU_TYPES = ['Program', 'FunctionBlock', 'Function', 'GVL'];
const PROGRAM_LANGUAGES = ['ST', 'IL'];
/**
 * Languages offered by each POU type. GVL has no language choice — it is always
 * a `.gvl` file, so it yields a single "GVL" option (the wizard skips the
 * language step when only one option exists).
 */
function languagesFor(type) {
    return type === 'GVL' ? ['GVL'] : PROGRAM_LANGUAGES;
}
const IEC_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** Valid IEC 61131-3 identifier: starts with a letter or underscore, then letters/digits/underscores. */
function validatePouName(name) {
    return IEC_IDENTIFIER.test(name);
}
function templateFor(type, language) {
    switch (type) {
        case 'Program':
            return language === 'ST'
                ? n => `(* ${n} — Structured Text Program *)\n\nPROGRAM ${n}\nVAR\n    (* variables *)\nEND_VAR\n\n(* code *)\n\nEND_PROGRAM\n`
                : n => `(* ${n} — Instruction List Program *)\n\nLD TRUE\nST result\n`;
        case 'FunctionBlock':
            return language === 'ST'
                ? n => `(* ${n} — Function Block *)\n\nFUNCTION_BLOCK ${n}\nVAR_INPUT\n    (* inputs *)\nEND_VAR\nVAR_OUTPUT\n    (* outputs *)\nEND_VAR\nVAR\n    (* variables *)\nEND_VAR\n\n(* code *)\n\nEND_FUNCTION_BLOCK\n`
                : n => `(* ${n} — Function Block (IL) *)\n\nLD TRUE\nST ${n}_out\n`;
        case 'Function':
            return language === 'ST'
                ? n => `(* ${n} — Function *)\n\nFUNCTION ${n} : RET\nVAR_INPUT\n    (* inputs *)\nEND_VAR\nVAR\n    (* variables *)\nEND_VAR\n\n(* result := 0; *)\n\nEND_FUNCTION\n`
                : n => `(* ${n} — Function (IL) *)\n\nLD TRUE\nST ${n}_result\n`;
        case 'GVL':
            return n => `(* ${n} — Global Variable List *)\n\nVAR_GLOBAL\n    (* global variables *)\nEND_VAR\n`;
    }
}
function dirFor(type) {
    switch (type) {
        case 'Program': return 'Programs';
        case 'FunctionBlock': return 'FBs';
        case 'Function': return 'Functions';
        case 'GVL': return 'GVL';
    }
}
function extFor(language) {
    switch (language) {
        case 'ST': return '.st';
        case 'IL': return '.il';
        case 'GVL': return '.gvl';
    }
}
/** Resolve the file target for a POU type + language. */
function pouTarget(type, language) {
    return { dir: dirFor(type), ext: extFor(language), template: templateFor(type, language) };
}
//# sourceMappingURL=pou-wizard-model.js.map