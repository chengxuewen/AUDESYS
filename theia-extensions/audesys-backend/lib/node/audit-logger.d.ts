declare const auditLogger: import("winston").Logger;
export interface AuditEntry {
    /** JSON-RPC method name */
    operation: string;
    /** RBAC role that made the call */
    role: string;
    /** Brief param summary — never includes full source code */
    paramSummary: string;
    /** Outcome of the operation */
    outcome: 'success' | 'error';
    /** Error message if outcome=error */
    errorMessage?: string;
}
/**
 * Structured auditing — every napi-rs call is logged with
 * timestamp, operation, role, paramSummary, outcome.
 *
 * Matches STH-014: structured JSON log file, no full source in logs.
 */
export declare function auditLog(entry: AuditEntry): void;
export { auditLogger };
//# sourceMappingURL=audit-logger.d.ts.map