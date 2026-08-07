/**
 * ST Compile JSON-RPC protocol — frontend/backend contract for the
 * napi-rs ST compiler bridge.
 *
 * The frontend bundle cannot load the native `@audesys/theia-bridge`
 * (browser mode), so compilation is routed to the Theia backend where
 * the .node binary lives. Mirrors the LD editor's ld-compile protocol.
 */

export const StCompileServicePath = '/services/st-compile';

/** Backend surface — mirrors `bridge.compileSt` (raw JSON HalProgram string). */
export interface StCompileServer {
    compileSt(source: string): string;
}