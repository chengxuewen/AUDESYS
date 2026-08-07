"use strict";
/**
 * Pure POU tree model — directory-convention grouping (A1-2).
 *
 * Zero @theia dependency so it can be unit-tested with vitest without pulling
 * in a DOM. Classifies a flat list of files into IEC 61131-3 POU groups
 * (Programs / FBs / Functions / GVL) by their parent directory name, per the
 * A1/A2 directory-convention decision — classification is by directory, not by
 * file content.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.POU_GROUP_ORDER = void 0;
exports.parentDirName = parentDirName;
exports.extOf = extOf;
exports.classifyToGroups = classifyToGroups;
/** Standard IEC POU group order (Programs / FBs / Functions / GVL). */
exports.POU_GROUP_ORDER = [
    { id: 'Programs', label: 'Programs' },
    { id: 'FBs', label: 'FBs' },
    { id: 'Functions', label: 'Functions' },
    { id: 'GVL', label: 'GVL' },
];
/** IEC program-language extensions accepted under Programs/FBs/Functions. */
const PROGRAM_EXTS = new Set(['.st', '.il', '.ld', '.fbd', '.sfc']);
/** GVL source extension. */
const GVL_EXTS = new Set(['.gvl']);
/** Extension allow-list per group id (directory convention wins for grouping). */
const GROUP_EXTS = {
    Programs: PROGRAM_EXTS,
    FBs: PROGRAM_EXTS,
    Functions: PROGRAM_EXTS,
    GVL: GVL_EXTS,
};
/** Extract the immediate parent directory name from a URI path. */
function parentDirName(uri) {
    const path = uri.replace(/^[a-z]+:\/\//i, '');
    const segments = path.split('/').filter(Boolean);
    const parent = segments[segments.length - 2];
    return parent ?? '';
}
/** Extract the lowercased file extension (incl leading dot) from a file name. */
function extOf(name) {
    const idx = name.lastIndexOf('.');
    if (idx <= 0) {
        return '';
    }
    return name.slice(idx).toLowerCase();
}
/**
 * Classify a flat list of files into POU groups by their parent directory.
 * Groups are returned in POU_GROUP_ORDER; groups with no matching files are
 * omitted; files outside a known POU directory or with an unrecognized
 * extension are skipped. Files within a group are sorted by name.
 */
function classifyToGroups(files) {
    const byGroup = new Map();
    for (const file of files) {
        const dir = parentDirName(file.uri);
        const allowed = GROUP_EXTS[dir];
        if (!allowed || !allowed.has(file.ext)) {
            continue;
        }
        const list = byGroup.get(dir) ?? [];
        list.push(file);
        byGroup.set(dir, list);
    }
    const groups = [];
    for (const { id, label } of exports.POU_GROUP_ORDER) {
        const files = byGroup.get(id);
        if (!files || files.length === 0) {
            continue;
        }
        groups.push({ id, label, files: [...files].sort((a, b) => a.name.localeCompare(b.name)) });
    }
    return groups;
}
//# sourceMappingURL=pou-tree-model.js.map