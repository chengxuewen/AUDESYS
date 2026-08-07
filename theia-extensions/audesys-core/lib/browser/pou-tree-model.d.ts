/**
 * Pure POU tree model — directory-convention grouping (A1-2).
 *
 * Zero @theia dependency so it can be unit-tested with vitest without pulling
 * in a DOM. Classifies a flat list of files into IEC 61131-3 POU groups
 * (Programs / FBs / Functions / GVL) by their parent directory name, per the
 * A1/A2 directory-convention decision — classification is by directory, not by
 * file content.
 */
export interface PouFileEntry {
    /** Full URI string of the file. */
    uri: string;
    /** File name including extension (display). */
    name: string;
    /** Lowercased extension including leading dot, e.g. '.st'. */
    ext: string;
}
export interface PouGroupEntry {
    /** Group id (equals the source directory name). */
    id: string;
    /** Human label shown in the tree. */
    label: string;
    /** Files classified under this group. */
    files: PouFileEntry[];
}
/** Standard IEC POU group order (Programs / FBs / Functions / GVL). */
export declare const POU_GROUP_ORDER: ReadonlyArray<{
    id: string;
    label: string;
}>;
/** Extract the immediate parent directory name from a URI path. */
export declare function parentDirName(uri: string): string;
/** Extract the lowercased file extension (incl leading dot) from a file name. */
export declare function extOf(name: string): string;
/**
 * Classify a flat list of files into POU groups by their parent directory.
 * Groups are returned in POU_GROUP_ORDER; groups with no matching files are
 * omitted; files outside a known POU directory or with an unrecognized
 * extension are skipped. Files within a group are sorted by name.
 */
export declare function classifyToGroups(files: readonly PouFileEntry[]): PouGroupEntry[];
//# sourceMappingURL=pou-tree-model.d.ts.map