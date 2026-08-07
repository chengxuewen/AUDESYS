"use strict";
/**
 * ST Compile JSON-RPC protocol — frontend/backend contract for the
 * napi-rs ST compiler bridge.
 *
 * The frontend bundle cannot load the native `@audesys/theia-bridge`
 * (browser mode), so compilation is routed to the Theia backend where
 * the .node binary lives. Mirrors the LD editor's ld-compile protocol.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StCompileServicePath = void 0;
exports.StCompileServicePath = '/services/st-compile';
//# sourceMappingURL=st-compile-protocol.js.map