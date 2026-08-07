/**
 * GVL global variable list pure model (A2-1).
 * Parses/serializes IEC 61131-3 `VAR_GLOBAL ... END_VAR` blocks.
 * Zero @theia dependency so it can be unit-tested without a DOM.
 */
export interface GvlVariable {
    name: string;
    type: string;
    init: string;
    comment: string;
}
/** A2-3 type subset — the dropdown offered by the GVL table editor. */
export declare const GVL_TYPES: Readonly<string[]>;
/**
 * Extract the variables declared in a GVL file's `VAR_GLOBAL ... END_VAR`
 * block. Lines outside the block, blank lines, and whole-line comments are
 * ignored. Malformed declaration lines are skipped (lenient parse).
 */
export declare function parseGvl(text: string): GvlVariable[];
/**
 * Serialize variables back into a `VAR_GLOBAL ... END_VAR` text block.
 * Init/comment omitted when empty. Round-trips through parseGvl.
 */
export declare function serializeGvl(vars: GvlVariable[]): string;
//# sourceMappingURL=gvl-model.d.ts.map