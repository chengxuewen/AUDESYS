"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
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
const inversify_1 = require("@theia/core/shared/inversify");
const common_1 = require("@theia/core/lib/common");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const st_project_compile_1 = require("../browser/st-project-compile");
const st_compile_protocol_1 = require("../common/st-compile-protocol");
/** Load the napi-rs bridge from the build's copied native dir. */
function loadBridge() {
    const nativeDir = path.join(__dirname, 'native');
    let files = [];
    try {
        // napi artifacts land as '<binaryName>.<platform>-<arch>.node'.
        files = fs.readdirSync(nativeDir).filter((f) => f.endsWith('.node') && (f.includes('audesys') || f.startsWith('index.')));
    }
    catch {
        // native dir missing — fall through to the node_modules copy below
    }
    for (const file of files) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            return require(path.join(nativeDir, file));
        }
        catch {
            // try next candidate
        }
    }
    // Fallback: node's runtime resolution (main = the .node binary).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@audesys/theia-bridge');
}
exports.default = new inversify_1.ContainerModule((bind) => {
    bind(common_1.ConnectionHandler).toDynamicValue(() => new common_1.JsonRpcConnectionHandler(st_compile_protocol_1.StCompileServicePath, () => {
        const bridge = loadBridge();
        const compileProgram = (input) => {
            try {
                const fn = (0, st_project_compile_1.compileKindForPath)(input.path) === 'il' ? bridge.compileIl : bridge.compileSt;
                fn(input.source);
                return { path: input.path, ok: true, message: '' };
            }
            catch (e) {
                return { path: input.path, ok: false, message: e instanceof Error ? e.message : String(e) };
            }
        };
        return {
            compileSt: (source) => bridge.compileSt(source),
            compileProject: (programs) => ({
                results: programs.map(compileProgram),
            }),
        };
    })).inSingletonScope();
});
//# sourceMappingURL=st-editor-backend-module.js.map