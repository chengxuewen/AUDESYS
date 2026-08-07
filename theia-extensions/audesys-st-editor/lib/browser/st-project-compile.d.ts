/**
 * Pure project-compile logic — maps a `ProjectCompileResult` (one outcome per
 * POU file) into per-file Monaco markers. Zero @theia dependency so it can be
 * unit-tested with vitest without pulling in a DOM.
 *
 * The backend compiles each file independently and records `{path, ok, message}`.
 * This module turns the failed entries into `StMarker[]` by parsing the
 * compiler message's "at line N, col M" (mirroring the single-file F7 path).
 */
import { CompileInput, FileCompileResult, ProjectCompileResult } from '../common/st-compile-protocol';
/** Monaco marker severity, as a string union so the module stays DOM-free. */
export type MarkerSeverityName = 'Error' | 'Warning' | 'Info' | 'Hint';
export interface StMarker {
    line: number;
    column: number;
    message: string;
    severity: MarkerSeverityName;
}
/**
 * Pick the compile entry point by file extension: .il routes to the IL
 * compiler, everything else (chiefly .st) routes to the ST compiler.
 */
export declare function compileKindForPath(path: string): 'il' | 'st';
/** Extract a 1-based {line, column} from a compiler message like "... at line 3, col 5". */
export declare function parsePosition(message: string): {
    line: number;
    column: number;
} | null;
/**
 * Map a project compile result to per-file markers. Only files that failed to
 * compile produce an entry; each error becomes one marker at the parsed line/
 * column (line 1 col 1 when the message carries no position, e.g. codegen
 * errors). Successful files produce no entry.
 */
export declare function mapProjectResultToMarkers(result: ProjectCompileResult): ReadonlyMap<string, StMarker[]>;
/** Convenience: the subset of results that failed. */
export declare function failedResults(results: readonly FileCompileResult[]): FileCompileResult[];
/** Convenience: normalize collected files into backend CompileInput[]. */
export declare function toCompileInputs(files: readonly {
    path: string;
    source: string;
}[]): CompileInput[];
//# sourceMappingURL=st-project-compile.d.ts.map