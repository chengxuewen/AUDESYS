"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogger = void 0;
exports.auditLog = auditLog;
const winston_1 = require("winston");
const { combine, timestamp, json } = winston_1.format;
const auditLogger = (0, winston_1.createLogger)({
    level: 'info',
    format: combine(timestamp({ format: 'ISO8601' }), json()),
    transports: [
        new winston_1.transports.Console(),
        new winston_1.transports.File({ filename: 'audit.log', dirname: '/tmp/audesys-audit' })
    ],
});
exports.auditLogger = auditLogger;
/**
 * Structured auditing — every napi-rs call is logged with
 * timestamp, operation, role, paramSummary, outcome.
 *
 * Matches STH-014: structured JSON log file, no full source in logs.
 */
function auditLog(entry) {
    auditLogger.info(entry);
}
//# sourceMappingURL=audit-logger.js.map