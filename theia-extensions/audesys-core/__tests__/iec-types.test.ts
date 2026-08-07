import { describe, it, expect } from 'vitest';
import { IEC_TYPES, isIecType, validateInit } from '../src/browser/iec-types';

describe('IEC_TYPES (A2-3)', () => {
    it('contains the five basic IEC types', () => {
        expect(IEC_TYPES).toEqual(['BOOL', 'INT', 'REAL', 'TIME', 'STRING']);
    });

    it('reports the frozen subset length (readonly at type level)', () => {
        expect(IEC_TYPES).toHaveLength(5);
    });
});

describe('isIecType (A2-3)', () => {
    it('returns true for all five types', () => {
        for (const t of IEC_TYPES) {
            expect(isIecType(t)).toBe(true);
        }
    });

    it('returns false for unknown types', () => {
        expect(isIecType('BYTE')).toBe(false);
        expect(isIecType('LREAL')).toBe(false);
        expect(isIecType('')).toBe(false);
        expect(isIecType('bool')).toBe(false); // case-sensitive
    });
});

describe('validateInit (A2-3)', () => {
    describe('empty init is always valid', () => {
        it.each(IEC_TYPES)('accepts empty string for %s', (type) => {
            expect(validateInit(type, '')).toBeNull();
            expect(validateInit(type, '  ')).toBeNull();
        });
    });

    describe('BOOL', () => {
        it('accepts TRUE/FALSE/0/1 (case-insensitive)', () => {
            for (const v of ['TRUE', 'FALSE', 'true', 'False', '0', '1']) {
                expect(validateInit('BOOL', v)).toBeNull();
            }
        });
        it('rejects other values', () => {
            expect(validateInit('BOOL', '2')).toBeTruthy();
            expect(validateInit('BOOL', 'yes')).toBeTruthy();
            expect(validateInit('BOOL', 'T')).toBeTruthy();
        });
    });

    describe('INT', () => {
        it('accepts plain and signed integers', () => {
            for (const v of ['0', '50', '-3', '+7', '999999']) {
                expect(validateInit('INT', v)).toBeNull();
            }
        });
        it('rejects non-integers', () => {
            expect(validateInit('INT', '1.5')).toBeTruthy();
            expect(validateInit('INT', 'abc')).toBeTruthy();
            expect(validateInit('INT', '1e3')).toBeTruthy();
        });
    });

    describe('REAL', () => {
        it('accepts integers, decimals, and scientific notation', () => {
            for (const v of ['0', '20.5', '-0.1', '1.5e3', '1E-2', '+3.14']) {
                expect(validateInit('REAL', v)).toBeNull();
            }
        });
        it('rejects non-numeric strings', () => {
            expect(validateInit('REAL', 'abc')).toBeTruthy();
            expect(validateInit('REAL', '1.2.3')).toBeTruthy();
            expect(validateInit('REAL', 'T#2s')).toBeTruthy();
        });
    });

    describe('TIME', () => {
        it('accepts T# prefix and plain integers', () => {
            for (const v of ['T#2s', 'T#100ms', 'T#1m30s', '0', '60']) {
                expect(validateInit('TIME', v)).toBeNull();
            }
        });
        it('rejects other formats', () => {
            expect(validateInit('TIME', '2s')).toBeTruthy();
            expect(validateInit('TIME', '1.5')).toBeTruthy();
            expect(validateInit('TIME', 'abc')).toBeTruthy();
        });
    });

    describe('STRING', () => {
        it('accepts single- and double-quoted strings', () => {
            for (const v of ["'hello'", '"world"', "'it''s'", '""', "''"]) {
                expect(validateInit('STRING', v)).toBeNull();
            }
        });
        it('rejects unquoted strings', () => {
            expect(validateInit('STRING', 'hello')).toBeTruthy();
            expect(validateInit('STRING', "'unterminated")).toBeTruthy();
            expect(validateInit('STRING', '123')).toBeTruthy();
        });
    });

    describe('unknown type', () => {
        it('returns error for unsupported type', () => {
            expect(validateInit('BYTE', '0')).toContain('Unknown IEC type');
        });
    });
});
