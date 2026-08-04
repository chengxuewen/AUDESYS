/**
 * LD Compile JSON-RPC protocol — frontend/backend contract for the
 * napi-rs LD compiler bridge.
 *
 * The frontend bundle cannot load the native `@audesys/theia-bridge`
 * (browser mode), so compilation is routed to the Theia backend where
 * the .node binary lives.
 */

export const LdCompileServicePath = '/services/ld-compile';

/** Backend surface — mirrors `bridge.compileLd` (raw JSON string result). */
export interface LdCompileServer {
    compileLd(source: string): string;
}
