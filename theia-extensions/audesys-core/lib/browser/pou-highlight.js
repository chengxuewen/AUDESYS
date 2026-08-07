"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findHighlightedFile = findHighlightedFile;
exports.findPouGroupOf = findPouGroupOf;
/**
 * Return the POU file whose uri equals the active editor uri, or null when the
 * active editor is not part of any POU group (e.g. a settings file, a nested
 * non-POU path, or no active editor).
 */
function findHighlightedFile(activeUri, groups) {
    if (!activeUri) {
        return null;
    }
    for (const group of groups) {
        const match = group.files.find((file) => file.uri === activeUri);
        if (match) {
            return match;
        }
    }
    return null;
}
/**
 * Return the POU group that owns the active editor uri, or null if it does not
 * belong to any POU group. Used by the widget to auto-expand the owning group.
 */
function findPouGroupOf(activeUri, groups) {
    if (!activeUri) {
        return null;
    }
    return groups.find((group) => group.files.some((file) => file.uri === activeUri)) ?? null;
}
//# sourceMappingURL=pou-highlight.js.map