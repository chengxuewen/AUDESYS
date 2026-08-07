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
export const POU_GROUP_ORDER: ReadonlyArray<{ id: string; label: string }> = [
    { id: 'Programs', label: 'Programs' },
    { id: 'FBs', label: 'FBs' },
    { id: 'Functions', label: 'Functions' },
    { id: 'GVL', label: 'GVL' },
];

/** IEC program-language extensions accepted under Programs/FBs/Functions. */
const PROGRAM_EXTS: ReadonlySet<string> = new Set(['.st', '.il', '.ld', '.fbd', '.sfc']);
/** GVL source extension. */
const GVL_EXTS: ReadonlySet<string> = new Set(['.gvl']);

/** Extension allow-list per group id (directory convention wins for grouping). */
const GROUP_EXTS: Readonly<Record<string, ReadonlySet<string>>> = {
    Programs: PROGRAM_EXTS,
    FBs: PROGRAM_EXTS,
    Functions: PROGRAM_EXTS,
    GVL: GVL_EXTS,
};

/** Extract the immediate parent directory name from a URI path. */
export function parentDirName(uri: string): string {
    const path = uri.replace(/^[a-z]+:\/\//i, '');
    const segments = path.split('/').filter(Boolean);
    const parent = segments[segments.length - 2];
    return parent ?? '';
}

/** Extract the lowercased file extension (incl leading dot) from a file name. */
export function extOf(name: string): string {
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
export function classifyToGroups(files: readonly PouFileEntry[]): PouGroupEntry[] {
    const byGroup = new Map<string, PouFileEntry[]>();
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
    const groups: PouGroupEntry[] = [];
    for (const { id, label } of POU_GROUP_ORDER) {
        const files = byGroup.get(id);
        if (!files || files.length === 0) {
            continue;
        }
        groups.push({ id, label, files: [...files].sort((a, b) => a.name.localeCompare(b.name)) });
    }
    return groups;
}