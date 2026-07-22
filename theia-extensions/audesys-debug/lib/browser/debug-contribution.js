"use strict";
/**
 * AUDESYS Debug Contribution — Registers the 'audesys' debug type in Theia.
 *
 * Provides default debug configurations and wires the AudesysDebugSession.
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudesysDebugSessionContribution = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const debug_session_connection_1 = require("@theia/debug/lib/browser/debug-session-connection");
const output_channel_1 = require("@theia/output/lib/browser/output-channel");
const debug_session_1 = require("./debug-session");
let AudesysDebugSessionContribution = class AudesysDebugSessionContribution {
    constructor() {
        this.debugType = debug_session_1.AUDESYS_DEBUG_TYPE;
    }
    debugSessionFactory() {
        return new AudesysDebugSessionFactory();
    }
};
exports.AudesysDebugSessionContribution = AudesysDebugSessionContribution;
__decorate([
    (0, inversify_1.inject)(output_channel_1.OutputChannelManager),
    __metadata("design:type", output_channel_1.OutputChannelManager)
], AudesysDebugSessionContribution.prototype, "outputChannelManager", void 0);
exports.AudesysDebugSessionContribution = AudesysDebugSessionContribution = __decorate([
    (0, inversify_1.injectable)()
], AudesysDebugSessionContribution);
class AudesysDebugSessionFactory {
    createSession(sessionId, options, parentSession) {
        const channel = debug_session_1.AudesysDebugSession.createChannel(options);
        const connection = new debug_session_connection_1.DebugSessionConnection(sessionId, () => Promise.resolve(channel), undefined);
        const data = {
            id: sessionId,
            options,
            parentSession,
        };
        // pony-tail: manual DI instead of Inversify child container — the factory pattern
        // is simpler for a single session type. Use child container if >2 session types.
        const session = new DebugSessionImpl(data, connection);
        return session;
    }
}
/**
 * pony-tail: concrete DebugSession subclass to assign read-only injected fields.
 * AudesysDebugSession uses @inject which triggers Inversify — for manual construction
 * we create a plain subclass that assigns fields directly.
 */
class DebugSessionImpl extends debug_session_1.AudesysDebugSession {
    constructor(data, connection) {
        // Bypass Inversify — assign fields directly via prototype
        super(data, connection);
        // Override readonly fields via Object.defineProperty
        Object.defineProperty(this, 'data', { value: data, writable: false });
        Object.defineProperty(this, 'connection', { value: connection, writable: false });
    }
}
//# sourceMappingURL=debug-contribution.js.map