"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileKindForPath = compileKindForPath;
exports.parsePosition = parsePosition;
exports.mapProjectResultToMarkers = mapProjectResultToMarkers;
exports.failedResults = failedResults;
exports.toCompileInputs = toCompileInputs;
/**
 * Pick the compile entry point by file extension: .il routes to the IL
 * compiler, everything else (chiefly .st) routes to the ST compiler.
 */
function compileKindForPath(path) {
    return path.toLowerCase().endsWith('.il') ? 'il' : 'st';
}
/** Extract a 1-based {line, column} from a compiler message like "... at line 3, col 5". */
function parsePosition(message) {
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
function mapProjectResultToMarkers(result) {
    const out = new Map();
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
function failedResults(results) {
    return results.filter((r) => !r.ok);
}
/** Convenience: normalize collected files into backend CompileInput[]. */
function toCompileInputs(files) {
    return files.map((f) => ({ path: f.path, source: f.source }));
}
//# sourceMappingURL=st-project-compile.js.map