/**
 * Pure project-compile logic — maps a `ProjectCompileResult` (one outcome per
 * POU file) into per-file Monaco markers. Zero @theia dependency so it can be
 * unit-tested with vitest without pulling in a DOM.
 *
 * The backend compiles each file independently and records `{path, ok, message}`.
 * This module turns the failed entries into `StMarker[]` by parsing the
 * compiler message's "at line N, col M" (mirroring the single-file F7 path).
 */
import {
    CompileInput, FileCompileResult, ProjectCompileResult,
} from '../common/st-compile-protocol';

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
export function compileKindForPath(path: string): 'il' | 'st' {
    return path.toLowerCase().endsWith('.il') ? 'il' : 'st';
}

/** Extract a 1-based {line, column} from a compiler message like "... at line 3, col 5". */
export function parsePosition(message: string): { line: number; column: number } | null {
    const m = /line\s+(\d+)(?:,\s*col\s+(\d+))?/i.exec(message);
    if (!m) {
        return null;
    }
    return { line: Number(m[1]), column: Number(m[2] ?? 1) };
}

/**
 * Map a project compile result to per-file markers. Only files that failed to
 * compile produce an entry; each error becomes one marker at the parsed line/
 * column (line 1 col 1 when the message carries no position, e.g. codegen
 * errors). Successful files produce no entry.
 */
export function mapProjectResultToMarkers(result: ProjectCompileResult): ReadonlyMap<string, StMarker[]> {
    const out = new Map<string, StMarker[]>();
    for (const r of result.results) {
        if (r.ok) {
            continue;
        }
        const pos = parsePosition(r.message);
        out.set(r.path, [{
            line: pos ? pos.line : 1,
            column: pos ? pos.column : 1,
            message: r.message,
            severity: 'Error',
        }]);
    }
    return out;
}

/** Convenience: the subset of results that failed. */
export function failedResults(results: readonly FileCompileResult[]): FileCompileResult[] {
    return results.filter((r) => !r.ok);
}

/** Convenience: normalize collected files into backend CompileInput[]. */
export function toCompileInputs(files: readonly { path: string; source: string }[]): CompileInput[] {
    return files.map((f) => ({ path: f.path, source: f.source }));
}