"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudesysBackendService = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const audit_logger_1 = require("./audit-logger");
const rbac_middleware_1 = require("./rbac-middleware");
const rate_limiter_1 = require("./rate-limiter");
const schema_validator_1 = require("./schema-validator");
// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
let AudesysBackendService = class AudesysBackendService {
    constructor() {
        this.sessions = new Map();
    }
    onStart() {
        try {
            // napi-rs index.js handles multi-platform resolution
            this.bridge = require('@audesys/theia-bridge');
            (0, audit_logger_1.auditLog)({
                operation: 'service:start',
                role: 'system',
                paramSummary: `bridge loaded, ${Object.keys(this.bridge).filter(k => typeof this.bridge[k] === 'function').length} functions available`,
                outcome: 'success',
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            (0, audit_logger_1.auditLog)({
                operation: 'service:start',
                role: 'system',
                paramSummary: 'bridge load failed',
                outcome: 'error',
                errorMessage: msg,
            });
            console.error('[audesys-backend] Failed to load napi-rs bridge:', msg);
            // ponytail: don't crash Theia startup, degrade gracefully
            this.bridge = {};
        }
    }
    // -----------------------------------------------------------------------
    // Session management (STH-020)
    // -----------------------------------------------------------------------
    connect(sessionId, socketPath, secret, role) {
        try {
            (0, schema_validator_1.validateNonEmptyString)(socketPath, 'socketPath');
            (0, schema_validator_1.validateNonEmptyString)(secret, 'secret');
            if (this.sessions.has(sessionId)) {
                return { success: false, error: { code: -32000, message: 'Session already exists' } };
            }
            this.sessions.set(sessionId, {
                id: sessionId,
                socketPath,
                secret,
                connected: true,
                reconnectAttempt: 0,
            });
            // Start heartbeat: every 1s (STH-020)
            const session = this.sessions.get(sessionId);
            session.heartbeatTimer = setInterval(() => {
                this.heartbeat(sessionId);
            }, 1000);
            (0, audit_logger_1.auditLog)({
                operation: 'session:connect',
                role,
                paramSummary: `session=${sessionId} path=${socketPath}`,
                outcome: 'success',
            });
            return { success: true, data: { sessionId, connected: true } };
        }
        catch (err) {
            return this.handleError(err, 'session:connect', role);
        }
    }
    disconnect(sessionId, role) {
        try {
            const session = this.sessions.get(sessionId);
            if (session) {
                if (session.heartbeatTimer)
                    clearInterval(session.heartbeatTimer);
                this.sessions.delete(sessionId);
                (0, rate_limiter_1.removeRateLimitSession)(sessionId);
            }
            (0, audit_logger_1.auditLog)({
                operation: 'session:disconnect',
                role,
                paramSummary: `session=${sessionId}`,
                outcome: 'success',
            });
            return { success: true };
        }
        catch (err) {
            return this.handleError(err, 'session:disconnect', role);
        }
    }
    heartbeat(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session || !session.connected)
            return;
        // ponytail: heartbeat just touches session — napi-rs UDS 0x00 ping
        // will be added when the Controller's HEARTBEAT IPC method is stable.
    }
    // ponytail: reconnect with exponential backoff (STH-020: 1-2-4-8s, max 3 retries)
    // Phase 1 keeps session alive; auto-reconnect implemented in follow-up task.
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    // -----------------------------------------------------------------------
    // Generic RPC dispatcher
    // -----------------------------------------------------------------------
    /**
     * The central dispatch — every napi-rs call goes through this method.
     * Applies rate limiting → RBAC → input validation → napi-rs call → audit.
     */
    async dispatch(method, params, sessionId, role) {
        try {
            // Rate limit check (STH-013)
            if (!(0, rate_limiter_1.checkRateLimit)(sessionId, method)) {
                return {
                    success: false,
                    error: { code: -32000, message: `Rate limited: ${method}` },
                };
            }
            // RBAC check (STH-012)
            (0, rbac_middleware_1.checkRbac)(role, method);
            // Input validation + napi-rs call
            const result = this.executeNapiCall(method, params);
            (0, audit_logger_1.auditLog)({
                operation: method,
                role,
                paramSummary: this.paramSummary(method, params),
                outcome: 'success',
            });
            return { success: true, data: result };
        }
        catch (err) {
            const errorResult = this.handleError(err, method, role);
            // Already logged in handleError
            return errorResult;
        }
    }
    // -----------------------------------------------------------------------
    // napi-rs call dispatch with per-method validation (STH-015)
    // -----------------------------------------------------------------------
    executeNapiCall(method, params) {
        const fn = this.bridge[method];
        if (typeof fn !== 'function') {
            throw new Error(`Unknown method: ${method}`);
        }
        switch (method) {
            // Compilers — validate source
            case 'compileSt':
            case 'compileIl':
            case 'compileLd':
            case 'compileFbd':
            case 'compileSfc':
            case 'compileGcode':
                (0, schema_validator_1.validateSource)(params[0], 'source');
                return fn(params[0]);
            // Deploy — validate socketPath, secret, payload
            case 'deployProgram':
                (0, schema_validator_1.validateNonEmptyString)(params[0], 'socketPath');
                (0, schema_validator_1.validateNonEmptyString)(params[1], 'secret');
                (0, schema_validator_1.validateNonEmptyString)(params[2], 'programJson');
                return fn(params[0], params[1], params[2]);
            case 'deployHmiLayout':
                (0, schema_validator_1.validateNonEmptyString)(params[0], 'socketPath');
                (0, schema_validator_1.validateNonEmptyString)(params[1], 'secret');
                (0, schema_validator_1.validateNonEmptyString)(params[2], 'yaml');
                return fn(params[0], params[1], params[2]);
            case 'loadHalConfig':
                (0, schema_validator_1.validateNonEmptyString)(params[0], 'socketPath');
                (0, schema_validator_1.validateNonEmptyString)(params[1], 'secret');
                (0, schema_validator_1.validateNonEmptyString)(params[2], 'yaml');
                return fn(params[0], params[1], params[2]);
            // Health
            case 'healthQuery':
                (0, schema_validator_1.validateNonEmptyString)(params[0], 'socketPath');
                (0, schema_validator_1.validateNonEmptyString)(params[1], 'secret');
                return fn(params[0], params[1]);
            // Signal reads
            case 'readSignal':
                (0, schema_validator_1.validateNonEmptyString)(params[0], 'socketPath');
                (0, schema_validator_1.validateNonEmptyString)(params[1], 'secret');
                (0, schema_validator_1.validateSignalName)(params[2], 'signalName');
                return fn(params[0], params[1], params[2]);
            case 'signalSnapshot':
                (0, schema_validator_1.validateNonEmptyString)(params[0], 'socketPath');
                (0, schema_validator_1.validateNonEmptyString)(params[1], 'secret');
                (0, schema_validator_1.validateString)(params[2], 'pattern');
                return fn(params[0], params[1], params[2]);
            // Debug operations
            case 'debugConnect':
                (0, schema_validator_1.validateNonEmptyString)(params[0], 'socketPath');
                (0, schema_validator_1.validateNonEmptyString)(params[1], 'secret');
                return fn(params[0], params[1]);
            case 'debugAddBreakpoint':
            case 'debugRemoveBreakpoint':
                (0, schema_validator_1.validateNumber)(params[0], 'ip');
                return fn(params[0]);
            case 'debugGetBreakpoints':
            case 'debugGetRegisters':
            case 'debugGetState':
            case 'debugDisconnect':
            case 'debugPause':
            case 'debugResume':
            case 'debugStep':
                return fn();
            // Project file ops
            case 'openProject':
                (0, schema_validator_1.validateNonEmptyString)(params[0], 'projectPath');
                return fn(params[0]);
            case 'readProjectFile':
                (0, schema_validator_1.validateNonEmptyString)(params[0], 'filePath');
                return fn(params[0]);
            // HMI layout file ops
            case 'loadHmiLayout':
            case 'saveHmiLayout':
                (0, schema_validator_1.validateNonEmptyString)(params[0], 'path');
                if (method === 'saveHmiLayout') {
                    (0, schema_validator_1.validateNonEmptyString)(params[1], 'yaml');
                    return fn(params[0], params[1]);
                }
                return fn(params[0]);
            // Simulation
            case 'simCreate':
                (0, schema_validator_1.validateNumber)(params[0], 'cycleMs');
                return fn(params[0]);
            case 'simDestroy':
            case 'simStep':
                return fn();
            default:
                // ponytail: pass-through for future methods, log a warning
                (0, audit_logger_1.auditLog)({
                    operation: 'dispatch:unknown',
                    role: 'system',
                    paramSummary: method,
                    outcome: 'error',
                    errorMessage: `Method ${method} dispatched without explicit validation`,
                });
                return fn(...params);
        }
    }
    // -----------------------------------------------------------------------
    // Error handling (STH-016)
    // -----------------------------------------------------------------------
    handleError(err, operation, role) {
        let code = -32001; // default JSON-RPC server error
        const message = err instanceof Error ? err.message : String(err);
        let data = undefined;
        if (err instanceof schema_validator_1.ValidationError) {
            code = -32602; // Invalid params
        }
        else if (err instanceof Error) {
            if (err.name === 'RbacError') {
                code = -32000; // permission denied
            }
            // ponytail: napi-rs errors map: CompileError→-32002, IpcError→-32003 (STH-016)
            // The .node returns JSON error strings — parse for structured data
            if (message.includes('CompileError') || message.includes('compilation')) {
                code = -32002;
                data = { type: 'CompileError', diagnostics: message };
            }
            else if (message.includes('IpcError') || message.includes('IPC')) {
                code = -32003;
                data = { type: 'IpcError', details: message };
            }
        }
        (0, audit_logger_1.auditLog)({
            operation,
            role,
            paramSummary: 'error',
            outcome: 'error',
            errorMessage: message,
        });
        return {
            success: false,
            error: { code, message, data },
        };
    }
    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------
    /** Build a param summary for audit log — never includes full source code (STH-014) */
    paramSummary(method, params) {
        if (params.length === 0)
            return '(no params)';
        switch (method) {
            case 'compileSt':
            case 'compileIl':
            case 'compileLd':
            case 'compileFbd':
            case 'compileSfc':
            case 'compileGcode': {
                const src = String(params[0]);
                return `source=${src.length} chars`;
            }
            case 'readSignal':
                return `signal="${params[2]}"`;
            case 'signalSnapshot':
                return `pattern="${params[2]}"`;
            case 'deployProgram':
            case 'deployHmiLayout':
                return `path="${params[0]}" payload=${String(params[2]).length} chars`;
            case 'debugAddBreakpoint':
            case 'debugRemoveBreakpoint':
                return `ip=${params[0]}`;
            default:
                return `${params.length} param(s)`;
        }
    }
};
exports.AudesysBackendService = AudesysBackendService;
exports.AudesysBackendService = AudesysBackendService = __decorate([
    (0, inversify_1.injectable)()
], AudesysBackendService);
//# sourceMappingURL=audesys-backend-service.js.map