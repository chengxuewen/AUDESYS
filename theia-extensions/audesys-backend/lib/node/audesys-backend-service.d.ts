import { BackendApplicationContribution } from '@theia/core/lib/node';
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
export declare class AudesysBackendService implements BackendApplicationContribution {
    private bridge;
    private sessions;
    onStart(): void;
    connect(sessionId: string, socketPath: string, secret: string, role: string): JsonRpcResult;
    disconnect(sessionId: string, role: string): JsonRpcResult;
    private heartbeat;
    getSession(sessionId: string): Session | undefined;
    /**
     * The central dispatch — every napi-rs call goes through this method.
     * Applies rate limiting → RBAC → input validation → napi-rs call → audit.
     */
    dispatch(method: string, params: unknown[], sessionId: string, role: string): Promise<JsonRpcResult>;
    private executeNapiCall;
    private handleError;
    /** Build a param summary for audit log — never includes full source code (STH-014) */
    private paramSummary;
}
export {};
//# sourceMappingURL=audesys-backend-service.d.ts.map