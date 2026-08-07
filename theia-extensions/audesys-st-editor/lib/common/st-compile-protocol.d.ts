/**
 * ST Compile JSON-RPC protocol — frontend/backend contract for the
 * napi-rs ST compiler bridge.
 *
 * The frontend bundle cannot load the native `@audesys/theia-bridge`
 * (browser mode), so compilation is routed to the Theia backend where
 * the .node binary lives. Mirrors the LD editor's ld-compile protocol.
 */
export declare const StCompileServicePath = "/services/st-compile";
/** One POU source file to compile (path + full source text). */
export interface CompileInput {
    /** Full URI string of the file — used to route .il vs .st and to report results. */
    path: string;
    /** Full source text. */
    source: string;
}
/** Per-file outcome of a project compile. */
export interface FileCompileResult {
    /** Matches the CompileInput.path. */
    path: string;
    /** true when the file compiled cleanly. */
    ok: boolean;
    /** Empty on success; compiler error text on failure (may carry 'at line N, col M'). */
    message: string;
}
/** Aggregate outcome of compiling every POU file in the project. */
export interface ProjectCompileResult {
    results: FileCompileResult[];
}
/** Backend surface — mirrors `bridge.compileSt` / `bridge.compileIl`. */
export interface StCompileServer {
    compileSt(source: string): string;
    /** Compile every POU file; each file is compiled independently (per-file try/catch). */
    compileProject(programs: CompileInput[]): ProjectCompileResult;
    /** A5: compile every POU file, merge into one HalProgram, deploy to the Runtime.
     * Returns a result message (e.g. "Deploy OK generation 3") or throws on failure.
     */
    deployProject(programs: CompileInput[]): string;
}
//# sourceMappingURL=st-compile-protocol.d.ts.map