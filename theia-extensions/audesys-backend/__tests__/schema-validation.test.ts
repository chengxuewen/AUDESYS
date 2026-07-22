import { describe, it, expect } from 'vitest';
import {
    ValidationError,
    validateSource,
    validateSignalName,
    validateNonEmptyString,
} from '../src/node/schema-validator';

describe('Schema Validator', () => {
    // ---------- validateSource ----------
    describe('validateSource', () => {
        it('rejects source > 1MB (UTF-8 bytes)', () => {
            // Create string where each char is 3 UTF-8 bytes (Chinese chars)
            const big = '字'.repeat(349_526); // 349,526 * 3 = 1,048,578 > 1,048,576
            expect(() => validateSource(big, 'source')).toThrow(ValidationError);
        });

        it('accepts source just under 1MB', () => {
            // ~1MB ASCII string (safe under limit)
            const ok = 'a'.repeat(1_000_000);
            expect(() => validateSource(ok, 'source')).not.toThrow();
        });

        it('rejects empty source', () => {
            expect(() => validateSource('', 'source')).toThrow(ValidationError);
            expect(() => validateSource('', 'source')).toThrow('must not be empty');
        });

        it('rejects non-string source', () => {
            expect(() => validateSource(42, 'source')).toThrow(ValidationError);
            expect(() => validateSource(null, 'source')).toThrow(ValidationError);
        });
    });

    // ---------- validateSignalName ----------
    describe('validateSignalName', () => {
        it('rejects signal name without dots', () => {
            expect(() => validateSignalName('axis0pos', 'signalName'))
                .toThrow('must match pattern');
        });

        it('rejects signal name with special chars like "!"', () => {
            expect(() => validateSignalName('axis.0.pos!', 'signalName'))
                .toThrow('must match pattern');
        });

        it('rejects signal name starting with digit', () => {
            expect(() => validateSignalName('0.axis.pos', 'signalName'))
                .toThrow('must match pattern');
        });

        it('accepts valid signal name "a.b.c"', () => {
            expect(() => validateSignalName('a.b.c', 'signalName'))
                .not.toThrow();
        });

        it('accepts valid signal name with underscores in third segment', () => {
            expect(() => validateSignalName('a.b.my_name', 'signalName'))
                .not.toThrow();
        });

        it('rejects non-string signal name', () => {
            expect(() => validateSignalName(123, 'signalName')).toThrow(ValidationError);
        });
    });

    // ---------- validateNonEmptyString ----------
    describe('validateNonEmptyString', () => {
        it('rejects empty string', () => {
            expect(() => validateNonEmptyString('', 'payload')).toThrow('must not be empty');
        });

        it('accepts non-empty string', () => {
            expect(() => validateNonEmptyString('hello', 'payload')).not.toThrow();
        });

        it('rejects non-string (e.g. number)', () => {
            expect(() => validateNonEmptyString(42, 'payload')).toThrow('expected string');
        });
    });

    // ---------- Error class ----------
    describe('ValidationError', () => {
        it('has name "ValidationError"', () => {
            const err = new ValidationError('oops');
            expect(err.name).toBe('ValidationError');
            expect(err.message).toBe('oops');
        });
    });
});
