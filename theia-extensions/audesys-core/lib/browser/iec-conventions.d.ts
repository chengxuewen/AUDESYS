/**
 * IEC 61131-3 directory-convention helpers (D113).
 * Pure, dependency-free module so it can be unit-tested without pulling in
 * @theia (which needs a DOM). Shared by the new-file command and the POU tree
 * view (A1-2).
 */
/**
 * Directory-convention mapping: language extension → subdirectory name under
 * the workspace root. Falling back to the root means a `.gvl`/unknown ext
 * still resolves predictably.
 */
export declare const IEC_LANG_DIR: Readonly<{
    [key: string]: string;
}>;
/**
 * Compute the next available filename inside a directory, auto-incrementing
 * when the plain name is already taken: untitled.st → untitled-1.st → ...
 */
export declare function nextFileName(isTaken: (name: string) => boolean, ext: string, base?: string): string;
//# sourceMappingURL=iec-conventions.d.ts.map