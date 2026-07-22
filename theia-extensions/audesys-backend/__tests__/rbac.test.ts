import { describe, it, expect } from 'vitest';
import { checkRbac, Role, RbacError } from '../src/node/rbac-middleware';

// ponytail: exhaustive RBAC table — one test per (role, method, expected) triple

describe('RBAC Middleware', () => {
    // ---------- Engineer ----------
    describe('Engineer role', () => {
        it('allows compile_st (WRITE_METHOD)', () => {
            expect(() => checkRbac(Role.Engineer, 'compileSt')).not.toThrow();
        });

        it('allows deploy_program (WRITE_METHOD)', () => {
            expect(() => checkRbac(Role.Engineer, 'deployProgram')).not.toThrow();
        });

        it('allows read_signal (READ_METHOD)', () => {
            expect(() => checkRbac(Role.Engineer, 'readSignal')).not.toThrow();
        });
    });

    // ---------- Operator ----------
    describe('Operator role', () => {
        it('denies compile_st', () => {
            expect(() => checkRbac(Role.Operator, 'compileSt')).toThrow(RbacError);
        });

        it('denies deploy_program', () => {
            expect(() => checkRbac(Role.Operator, 'deployProgram')).toThrow(RbacError);
        });

        it('allows read_signal', () => {
            expect(() => checkRbac(Role.Operator, 'readSignal')).not.toThrow();
        });
    });

    // ---------- HMI ----------
    describe('HMI role', () => {
        it('denies compile_st', () => {
            expect(() => checkRbac(Role.HMI, 'compileSt')).toThrow(RbacError);
        });

        it('denies deploy_program', () => {
            expect(() => checkRbac(Role.HMI, 'deployProgram')).toThrow(RbacError);
        });

        it('allows read_signal', () => {
            expect(() => checkRbac(Role.HMI, 'readSignal')).not.toThrow();
        });
    });

    // ---------- Viewer ----------
    describe('Viewer role', () => {
        it('denies compile_st', () => {
            expect(() => checkRbac(Role.Viewer, 'compileSt')).toThrow(RbacError);
        });

        it('denies deploy_program', () => {
            expect(() => checkRbac(Role.Viewer, 'deployProgram')).toThrow(RbacError);
        });

        it('allows read_signal', () => {
            expect(() => checkRbac(Role.Viewer, 'readSignal')).not.toThrow();
        });
    });

    // ---------- Auditor ----------
    describe('Auditor role', () => {
        it('denies compile_st', () => {
            expect(() => checkRbac(Role.Auditor, 'compileSt')).toThrow(RbacError);
        });

        it('denies deploy_program', () => {
            expect(() => checkRbac(Role.Auditor, 'deployProgram')).toThrow(RbacError);
        });

        it('allows read_signal', () => {
            expect(() => checkRbac(Role.Auditor, 'readSignal')).not.toThrow();
        });
    });

    // ---------- Admin ----------
    describe('Admin role', () => {
        it('allows compile_st', () => {
            expect(() => checkRbac(Role.Admin, 'compileSt')).not.toThrow();
        });

        it('allows deploy_program', () => {
            expect(() => checkRbac(Role.Admin, 'deployProgram')).not.toThrow();
        });

        it('allows read_signal', () => {
            expect(() => checkRbac(Role.Admin, 'readSignal')).not.toThrow();
        });
    });

    // ---------- Unknown ----------
    // ponytail: unknown roles resolve to Viewer (RBAC middleware line 62)
    // — writes denied, reads allowed
    describe('Unknown role', () => {
        it('denies compile_st (resolves to Viewer)', () => {
            expect(() => checkRbac('Unknown', 'compileSt')).toThrow(RbacError);
        });

        it('allows read_signal (resolves to Viewer which has read access)', () => {
            expect(() => checkRbac('Unknown', 'readSignal')).not.toThrow();
        });
    });

    // ---------- Edge cases ----------
    describe('RbacError message', () => {
        it('includes role and method in error message', () => {
            try {
                checkRbac(Role.Viewer, 'compileSt');
            } catch (err) {
                expect(err).toBeInstanceOf(RbacError);
                expect((err as RbacError).name).toBe('RbacError');
                expect((err as RbacError).message).toContain('Viewer');
                expect((err as RbacError).message).toContain('compileSt');
            }
        });
    });
});
