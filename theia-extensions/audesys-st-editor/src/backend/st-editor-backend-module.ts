/**
 * ST Editor Backend Module — compile via napi-rs bridge.
 *
 * The frontend cannot load the native `@audesys/theia-bridge` (browser
 * mode), so ST compilation is routed here over JSON-RPC. Mirrors the LD
 * editor's backend module (loadBridge + compile call).
 *
 * The esbuild bundle maps `@audesys/theia-bridge` to a path STRING (the
 * package.json main field) instead of the loaded addon, so the bridge is
 * loaded at runtime from the build's copied `native/` directory.
 */
import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, JsonRpcConnectionHandler } from '@theia/core/lib/common';
import * as fs from 'fs';
import * as path from 'path';
import { compileKindForPath } from '../browser/st-project-compile';
import { CompileInput, ProjectCompileResult, StCompileServer, StCompileServicePath } from '../common/st-compile-protocol';

/** Load the napi-rs bridge from the build's copied native dir. */
function loadBridge(): Record<string, Function> {
    const nativeDir = path.join(__dirname, 'native');
    let files: string[] = [];
    try {
        // napi artifacts land as '<binaryName>.<platform>-<arch>.node'.
        files = fs.readdirSync(nativeDir).filter(
            (f) => f.endsWith('.node') && (f.includes('audesys') || f.startsWith('index.')),
        );
    } catch {
        // native dir missing — fall through to the node_modules copy below
    }
    for (const file of files) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            return require(path.join(nativeDir, file));
        } catch {
            // try next candidate
        }
    }
    // Fallback: node's runtime resolution (main = the .node binary).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@audesys/theia-bridge');
}

export default new ContainerModule((bind) => {
    bind(ConnectionHandler).toDynamicValue(() =>
        new JsonRpcConnectionHandler<StCompileServer>(StCompileServicePath, () => {
            const bridge = loadBridge();
            const compileProgram = (input: CompileInput): { path: string; ok: boolean; message: string } => {
                try {
                    const fn = compileKindForPath(input.path) === 'il' ? bridge.compileIl : bridge.compileSt;
                    fn(input.source);
                    return { path: input.path, ok: true, message: '' };
                } catch (e) {
                    return { path: input.path, ok: false, message: e instanceof Error ? e.message : String(e) };
                }
            };
            return {
                compileSt: (source: string): string => bridge.compileSt(source),
                compileProject: (programs: CompileInput[]): ProjectCompileResult => ({
                    results: programs.map(compileProgram),
                }),
            };
        }),
    ).inSingletonScope();
});