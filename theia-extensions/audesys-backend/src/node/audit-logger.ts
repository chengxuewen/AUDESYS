import { createLogger, format, transports } from 'winston';

const { combine, timestamp, json } = format;

const auditLogger = createLogger({
    level: 'info',
    format: combine(
        timestamp({ format: 'ISO8601' }),
        json()
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: 'audit.log', dirname: '/tmp/audesys-audit' })
    ],
});

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
export function auditLog(entry: AuditEntry): void {
    auditLogger.info(entry);
}

export { auditLogger };
