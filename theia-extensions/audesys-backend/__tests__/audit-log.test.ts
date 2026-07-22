import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auditLog, AuditEntry, auditLogger } from '../src/node/audit-logger';

describe('Audit Logger', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('logs compile_st call with required fields', () => {
        const spy = vi.spyOn(auditLogger, 'info').mockReturnValue(auditLogger);

        const entry: AuditEntry = {
            operation: 'compileSt',
            role: 'Engineer',
            paramSummary: 'source=42 chars',
            outcome: 'success',
        };

        auditLog(entry);

        expect(spy).toHaveBeenCalledTimes(1);
        const logged = spy.mock.calls[0][0] as AuditEntry;
        expect(logged.operation).toBe('compileSt');
        expect(logged.role).toBe('Engineer');
        expect(logged.paramSummary).toBe('source=42 chars');
        expect(logged.outcome).toBe('success');
    });

    it('logs read_signal call with required fields', () => {
        const spy = vi.spyOn(auditLogger, 'info').mockReturnValue(auditLogger);

        auditLog({
            operation: 'readSignal',
            role: 'Operator',
            paramSummary: 'signal="tank.level"',
            outcome: 'success',
        });

        expect(spy).toHaveBeenCalledTimes(1);
        const logged = spy.mock.calls[0][0] as AuditEntry;
        expect(logged.operation).toBe('readSignal');
        expect(logged.role).toBe('Operator');
        expect(logged.paramSummary).toBe('signal="tank.level"');
    });

    it('logs error outcome with errorMessage', () => {
        const spy = vi.spyOn(auditLogger, 'info').mockReturnValue(auditLogger);

        auditLog({
            operation: 'compileSt',
            role: 'Viewer',
            paramSummary: 'error',
            outcome: 'error',
            errorMessage: 'RBAC denied',
        });

        expect(spy).toHaveBeenCalledTimes(1);
        const logged = spy.mock.calls[0][0] as AuditEntry;
        expect(logged.outcome).toBe('error');
        expect(logged.errorMessage).toBe('RBAC denied');
    });

    it('audit entry has all required fields (operation, role, paramSummary, outcome)', () => {
        const spy = vi.spyOn(auditLogger, 'info').mockReturnValue(auditLogger);

        auditLog({
            operation: 'deployProgram',
            role: 'Admin',
            paramSummary: 'payload=1024 chars',
            outcome: 'success',
        });

        const logged = spy.mock.calls[0][0] as Record<string, unknown>;
        expect(logged).toHaveProperty('operation');
        expect(logged).toHaveProperty('role');
        expect(logged).toHaveProperty('paramSummary');
        expect(logged).toHaveProperty('outcome');
    });
});
