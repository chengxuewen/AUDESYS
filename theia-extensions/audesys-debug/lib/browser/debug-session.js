"use strict";
/**
 * AUDESYS Debug Session — TheiaDebugSession subclass.
 *
 * Connects to an AUDESYS Controller via our custom DebugChannel,
 * providing DAP 12-command adapter for the Theia Debug UI.
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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudesysDebugSession = exports.AUDESYS_DEBUG_TYPE = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const debug_session_1 = require("@theia/debug/lib/browser/debug-session");
const debug_session_connection_1 = require("@theia/debug/lib/browser/debug-session-connection");
const debug_channel_1 = require("./debug-channel");
exports.AUDESYS_DEBUG_TYPE = 'audesys';
let AudesysDebugSession = class AudesysDebugSession extends debug_session_1.DebugSession {
    constructor(data, connection) {
        super();
        this.data = data;
        this.connection = connection;
    }
    static createChannel(options) {
        const config = options.configuration;
        const socketPath = (typeof config.socketPath === 'string')
            ? config.socketPath
            : '/tmp/audesys-controller.sock';
        const secret = (typeof config.secret === 'string')
            ? config.secret
            : 'audesys-dev-secret';
        return new debug_channel_1.AudesysDebugChannel({ socketPath, secret });
    }
};
exports.AudesysDebugSession = AudesysDebugSession;
exports.AudesysDebugSession = AudesysDebugSession = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)(debug_session_1.DebugSessionData)),
    __param(1, (0, inversify_1.inject)(debug_session_connection_1.DebugSessionConnection)),
    __metadata("design:paramtypes", [Object, debug_session_connection_1.DebugSessionConnection])
], AudesysDebugSession);
//# sourceMappingURL=debug-session.js.map