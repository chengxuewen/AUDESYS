import { injectable } from '@theia/core/shared/inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node';

import { auditLog } from './audit-logger';
import { checkRbac, Role } from './rbac-middleware';
import { checkRateLimit, removeRateLimitSession } from './rate-limiter';
import {
    validateSource,
    validateSignalName,
    validateString,
    validateNumber,
    validateNonEmptyString,
    ValidationError,
} from './schema-validator';

import type * as NapiBridge from '@audesys/theia-bridge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Session {
    id: string;
    socketPath: string;
    secret: string;
    connected: boolean;
    heartbeatTimer?: ReturnType<typeof setInterval>;
    reconnectAttempt: number;
}

interface JsonRpcResult {
    success: boolean;
    data?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@injectable()
export class AudesysBackendService implements BackendApplicationContribution {
    private bridge!: typeof NapiBridge;
    private sessions: Map<string, Session> = new Map();

    onStart(): void {
        try {
            // napi-rs index.js handles multi-platform resolution
            this.bridge = require('@audesys/theia-bridge');
            auditLog({
                operation: 'service:start',
                role: 'system',
                paramSummary: `bridge loaded, ${Object.keys(this.bridge as Record<string, unknown>).filter(k => typeof (this.bridge as Record<string, unknown>)[k] === 'function').length} functions available`,
                outcome: 'success',
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            auditLog({
                operation: 'service:start',
                role: 'system',
                paramSummary: 'bridge load failed',
                outcome: 'error',
                errorMessage: msg,
            });
            console.error('[audesys-backend] Failed to load napi-rs bridge:', msg);
            // ponytail: don't crash Theia startup, degrade gracefully
            this.bridge = {} as typeof NapiBridge;
        }
    }

    // -----------------------------------------------------------------------
    // Session management (STH-020)
    // -----------------------------------------------------------------------

    connect(sessionId: string, socketPath: string, secret: string, role: string): JsonRpcResult {
        try {
            validateNonEmptyString(socketPath, 'socketPath');
            validateNonEmptyString(secret, 'secret');

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
            const session = this.sessions.get(sessionId)!;
            session.heartbeatTimer = setInterval(() => {
                this.heartbeat(sessionId);
            }, 1000);

            auditLog({
                operation: 'session:connect',
                role,
                paramSummary: `session=${sessionId} path=${socketPath}`,
                outcome: 'success',
            });

            return { success: true, data: { sessionId, connected: true } };
        } catch (err) {
            return this.handleError(err, 'session:connect', role);
        }
    }

    disconnect(sessionId: string, role: string): JsonRpcResult {
        try {
            const session = this.sessions.get(sessionId);
            if (session) {
                if (session.heartbeatTimer) clearInterval(session.heartbeatTimer);
                this.sessions.delete(sessionId);
                removeRateLimitSession(sessionId);
            }

            auditLog({
                operation: 'session:disconnect',
                role,
                paramSummary: `session=${sessionId}`,
                outcome: 'success',
            });

            return { success: true };
        } catch (err) {
            return this.handleError(err, 'session:disconnect', role);
        }
    }

    private heartbeat(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session || !session.connected) return;
        // ponytail: heartbeat just touches session — napi-rs UDS 0x00 ping
        // will be added when the Controller's HEARTBEAT IPC method is stable.
    }

    // ponytail: reconnect with exponential backoff (STH-020: 1-2-4-8s, max 3 retries)
    // Phase 1 keeps session alive; auto-reconnect implemented in follow-up task.
    getSession(sessionId: string): Session | undefined {
        return this.sessions.get(sessionId);
    }

    // -----------------------------------------------------------------------
    // Generic RPC dispatcher
    // -----------------------------------------------------------------------

    /**
     * The central dispatch — every napi-rs call goes through this method.
     * Applies rate limiting → RBAC → input validation → napi-rs call → audit.
     */
    async dispatch(
        method: string,
        params: unknown[],
        sessionId: string,
        role: string,
    ): Promise<JsonRpcResult> {
        try {
            // Rate limit check (STH-013)
            if (!checkRateLimit(sessionId, method)) {
                return {
                    success: false,
                    error: { code: -32000, message: `Rate limited: ${method}` },
                };
            }

            // RBAC check (STH-012)
            checkRbac(role, method);

            // Input validation + napi-rs call
            const result = this.executeNapiCall(method, params);

            auditLog({
                operation: method,
                role,
                paramSummary: this.paramSummary(method, params),
                outcome: 'success',
            });

            return { success: true, data: result };
        } catch (err) {
            const errorResult = this.handleError(err, method, role);
            // Already logged in handleError
            return errorResult;
        }
    }

    // -----------------------------------------------------------------------
    // napi-rs call dispatch with per-method validation (STH-015)
    // -----------------------------------------------------------------------

    private executeNapiCall(method: string, params: unknown[]): unknown {
        const fn = (this.bridge as Record<string, Function>)[method];
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
                validateSource(params[0], 'source');
                return fn(params[0]);

            // Deploy — validate socketPath, secret, payload
            case 'deployProgram':
                validateNonEmptyString(params[0], 'socketPath');
                validateNonEmptyString(params[1], 'secret');
                validateNonEmptyString(params[2], 'programJson');
                return fn(params[0], params[1], params[2]);

            case 'deployHmiLayout':
                validateNonEmptyString(params[0], 'socketPath');
                validateNonEmptyString(params[1], 'secret');
                validateNonEmptyString(params[2], 'yaml');
                return fn(params[0], params[1], params[2]);

            case 'loadHalConfig':
                validateNonEmptyString(params[0], 'socketPath');
                validateNonEmptyString(params[1], 'secret');
                validateNonEmptyString(params[2], 'yaml');
                return fn(params[0], params[1], params[2]);

            // Health
            case 'healthQuery':
                validateNonEmptyString(params[0], 'socketPath');
                validateNonEmptyString(params[1], 'secret');
                return fn(params[0], params[1]);

            // Signal reads
            case 'readSignal':
                validateNonEmptyString(params[0], 'socketPath');
                validateNonEmptyString(params[1], 'secret');
                validateSignalName(params[2], 'signalName');
                return fn(params[0], params[1], params[2]);

            case 'signalSnapshot':
                validateNonEmptyString(params[0], 'socketPath');
                validateNonEmptyString(params[1], 'secret');
                validateString(params[2], 'pattern');
                return fn(params[0], params[1], params[2]);

            // Debug operations
            case 'debugConnect':
                validateNonEmptyString(params[0], 'socketPath');
                validateNonEmptyString(params[1], 'secret');
                return fn(params[0], params[1]);

            case 'debugAddBreakpoint':
            case 'debugRemoveBreakpoint':
                validateNumber(params[0], 'ip');
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
                validateNonEmptyString(params[0], 'projectPath');
                return fn(params[0]);

            case 'readProjectFile':
                validateNonEmptyString(params[0], 'filePath');
                return fn(params[0]);

            // HMI layout file ops
            case 'loadHmiLayout':
            case 'saveHmiLayout':
                validateNonEmptyString(params[0], 'path');
                if (method === 'saveHmiLayout') {
                    validateNonEmptyString(params[1], 'yaml');
                    return fn(params[0], params[1]);
                }
                return fn(params[0]);

            // Simulation
            case 'simCreate':
                validateNumber(params[0], 'cycleMs');
                return fn(params[0]);

            case 'simDestroy':
            case 'simStep':
                return fn();

            default:
                // ponytail: pass-through for future methods, log a warning
                auditLog({
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

    private handleError(err: unknown, operation: string, role: string): JsonRpcResult {
        let code = -32001; // default JSON-RPC server error
        const message = err instanceof Error ? err.message : String(err);
        let data: unknown = undefined;

        if (err instanceof ValidationError) {
            code = -32602; // Invalid params
        } else if (err instanceof Error) {
            if (err.name === 'RbacError') {
                code = -32000; // permission denied
            }
            // ponytail: napi-rs errors map: CompileError→-32002, IpcError→-32003 (STH-016)
            // The .node returns JSON error strings — parse for structured data
            if (message.includes('CompileError') || message.includes('compilation')) {
                code = -32002;
                data = { type: 'CompileError', diagnostics: message };
            } else if (message.includes('IpcError') || message.includes('IPC')) {
                code = -32003;
                data = { type: 'IpcError', details: message };
            }
        }

        auditLog({
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
    private paramSummary(method: string, params: unknown[]): string {
        if (params.length === 0) return '(no params)';

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
}
