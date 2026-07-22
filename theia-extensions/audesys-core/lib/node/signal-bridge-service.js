"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalBridgeServer = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const bridge = require('@audesys/theia-bridge');
/**
 * Backend implementation that wraps the napi-rs native bridge.
 *
 * Runs in Node.js main process where native modules are loadable.
 * Exposed to the frontend via Theia JSON-RPC.
 */
let SignalBridgeServer = class SignalBridgeServer {
    dispose() {
        // no-op: bridge is stateless, no cleanup needed
    }
    setClient(_client) {
        // no-op: bridge calls are one-shot, no push notifications yet
    }
    async signalSnapshot(pattern) {
        // ponytail: synchronous native call, no need for worker pool at this scale
        const raw = bridge.signalSnapshot(pattern);
        return JSON.parse(raw);
    }
};
exports.SignalBridgeServer = SignalBridgeServer;
exports.SignalBridgeServer = SignalBridgeServer = __decorate([
    (0, inversify_1.injectable)()
], SignalBridgeServer);
//# sourceMappingURL=signal-bridge-service.js.map