/**
 * LD Editor Backend Module — compile via napi-rs bridge.
 *
 * D110: 无 GLSP 服务器。前端无法加载原生 .node 模块（浏览器模式），
 * 编译经 JSON-RPC 路由到后端执行。
 *
 * The esbuild bundle maps `@audesys/theia-bridge` to a path STRING (the
 * package.json main field) instead of the loaded addon, so the bridge is
 * loaded at runtime from the build's copied `native/` directory.
 */
import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, JsonRpcConnectionHandler } from '@theia/core/lib/common';
import * as fs from 'fs';
import * as path from 'path';
import { LdCompileServer, LdCompileServicePath } from '../common/ld-compile-protocol';

/** Load the napi-rs bridge from the build's copied native dir. */
function loadBridge(): Record<string, Function> {
    const nativeDir = path.join(__dirname, 'native');
    let files: string[] = [];
    try {
        // napi artifacts land as '<binaryName>.<platform>-<arch>.node' — the
        // current build outputs index.darwin-x64.node (package.json main).
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
        new JsonRpcConnectionHandler<LdCompileServer>(LdCompileServicePath, () => {
            const bridge = loadBridge();
            return {
                compileLd: (source: string): string => bridge.compileLd(source),
            };
        }),
    ).inSingletonScope();
});