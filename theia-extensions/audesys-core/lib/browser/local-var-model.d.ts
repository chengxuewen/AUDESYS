/**
 * Local variable pure model (A2-2).
 * Parses/serializes the `VAR ... END_VAR` block of a ST/IL POU file.
 * Only the first plain `VAR` block (no suffix like VAR_INPUT/VAR_OUTPUT) is
 * handled — the POU's main local-variable region, matching the A1-4 template.
 * Zero @theia dependency so it can be unit-tested without a DOM.
 */
import { GvlVariable } from './gvl-model';
/** A local var shares the GVL shape (name/type/init/comment). */
export type LocalVariable = GvlVariable;
/** Reuse the A2-1 type subset for the dropdown. */
export declare const LOCAL_TYPES: Readonly<string[]>;
/** Line indices (0-based) of a `VAR ... END_VAR` block in the source text. */
export interface VarBlockRange {
    /** Index of the `VAR` line. */
    startLine: number;
    /** Index of the matching `END_VAR` line. */
    endLine: number;
}
/**
 * Locate the first plain `VAR` block. `VAR` is matched exactly (not
 * VAR_INPUT/VAR_OUTPUT/VAR_TEMP/VAR_GLOBAL). Returns null when absent.
 */
export declare function findFirstLocalVarBlock(text: string): VarBlockRange | null;
/**
 * Extract the variables declared inside the first `VAR ... END_VAR` block.
 * Lines outside the block, blank lines, and whole-line comments are ignored.
 * Malformed declaration lines are skipped (lenient parse).
 */
export declare function parseLocalVars(text: string): LocalVariable[];
/**
 * Serialize variables back into the FIRST `VAR ... END_VAR` block of the
 * original text, preserving everything else (PROGRAM/END_PROGRAM headers,
 * statements, other VAR blocks). The `VAR`/`END_VAR` lines keep their
 * original indentation. Round-trips through parseLocalVars.
 *
 * Returns the original text unchanged when the file has no `VAR` block.
 */
export declare function serializeLocalVars(originalText: string, vars: LocalVariable[]): string;
//# sourceMappingURL=local-var-model.d.ts.map