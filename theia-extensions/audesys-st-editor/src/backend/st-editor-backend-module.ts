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
import { mergeHalPrograms } from '../browser/deploy-model';
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
            const compile = (input: CompileInput): string => {
                const fn = compileKindForPath(input.path) === 'il' ? bridge.compileIl : bridge.compileSt;
                return fn(input.source) as string; // HalProgram JSON; throws on compile error
            };
            const compileProgram = (input: CompileInput): { path: string; ok: boolean; message: string } => {
                try {
                    compile(input);
                    return { path: input.path, ok: true, message: '' };
                } catch (e) {
                    return { path: input.path, ok: false, message: e instanceof Error ? e.message : String(e) };
                }
            };
            const deployProject = (programs: CompileInput[]): string => {
                const jsons = programs.map((input) => {
                    try {
                        return compile(input);
                    } catch (e) {
                        throw new Error(`compile failed for ${input.path}: ${e instanceof Error ? e.message : String(e)}`);
                    }
                });
                const merged = mergeHalPrograms(jsons);
                const socket = process.env.AUDESYS_SOCKET ?? '/tmp/audesys-runtime.sock';
                const secret = process.env.AUDESYS_SECRET ?? '';
                return bridge.deploy_program(socket, secret, merged) as string;
            };
            return {
                compileSt: (source: string): string => bridge.compileSt(source) as string,
                compileProject: (programs: CompileInput[]): ProjectCompileResult => ({
                    results: programs.map(compileProgram),
                }),
                deployProject,
            };
        }),
    ).inSingletonScope();
});