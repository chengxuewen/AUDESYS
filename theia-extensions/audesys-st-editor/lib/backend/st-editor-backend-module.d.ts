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
declare const _default: ContainerModule;
export default _default;
//# sourceMappingURL=st-editor-backend-module.d.ts.map