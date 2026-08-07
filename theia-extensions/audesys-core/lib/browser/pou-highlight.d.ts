/**
 * Pure POU highlight model — editor↔tree bidirectional location (A1-3).
 *
 * Zero @theia dependency so it can be unit-tested with vitest without pulling
 * in a DOM. Given the currently-active editor's URI and the POU group list
 * (from classifyToGroups), decides which file (if any) should be highlighted in
 * the POU tree.
 */
import { PouFileEntry, PouGroupEntry } from './pou-tree-model';
/**
 * Return the POU file whose uri equals the active editor uri, or null when the
 * active editor is not part of any POU group (e.g. a settings file, a nested
 * non-POU path, or no active editor).
 */
export declare function findHighlightedFile(activeUri: string, groups: readonly PouGroupEntry[]): PouFileEntry | null;
/**
 * Return the POU group that owns the active editor uri, or null if it does not
 * belong to any POU group. Used by the widget to auto-expand the owning group.
 */
export declare function findPouGroupOf(activeUri: string, groups: readonly PouGroupEntry[]): PouGroupEntry | null;
//# sourceMappingURL=pou-highlight.d.ts.map