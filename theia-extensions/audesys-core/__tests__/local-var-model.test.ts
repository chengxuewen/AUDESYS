import { describe, it, expect } from 'vitest';
import {
    LOCAL_TYPES,
    LocalVariable,
    findFirstLocalVarBlock,
    parseLocalVars,
    serializeLocalVars,
} from '../src/browser/local-var-model';

const var_ = (name: string, type: string, init = '', comment = ''): LocalVariable =>
    ({ name, type, init, comment });

describe('findFirstLocalVarBlock (A2-2)', () => {
    it('locates the plain VAR/END_VAR block in a ST program', () => {
        const text = [
            'PROGRAM Main',
            'VAR',
            '    a : BOOL;',
            'END_VAR',
            'END_PROGRAM',
        ].join('\n');
        expect(findFirstLocalVarBlock(text)).toEqual({ startLine: 1, endLine: 3 });
    });

    it('does not match VAR_INPUT / VAR_OUTPUT / VAR_TEMP', () => {
        const text = [
            'PROGRAM Main',
            'VAR_INPUT',
            '    x : INT;',
            'END_VAR',
            'END_PROGRAM',
        ].join('\n');
        expect(findFirstLocalVarBlock(text)).toBeNull();
    });

    it('returns null when there is no VAR block', () => {
        expect(findFirstLocalVarBlock('PROGRAM p\nEND_PROGRAM')).toBeNull();
        expect(findFirstLocalVarBlock('')).toBeNull();
    });
});

describe('parseLocalVars (A2-2)', () => {
    it('parses the first VAR block, ignoring surrounding code', () => {
        const text = [
            'PROGRAM Pump',
            'VAR',
            '    running : BOOL := FALSE; (* is pump on *)',
            '    setpoint : INT := 50;',
            'END_VAR',
            '    running := TRUE;',
            'END_PROGRAM',
        ].join('\n');
        expect(parseLocalVars(text)).toEqual([
            var_('running', 'BOOL', 'FALSE', 'is pump on'),
            var_('setpoint', 'INT', '50'),
        ]);
    });

    it('skips blank lines and whole-line comments inside the block', () => {
        const text = [
            'PROGRAM p',
            'VAR',
            '    (* header *)',
            '',
            '    a : REAL;',
            'END_VAR',
            'END_PROGRAM',
        ].join('\n');
        expect(parseLocalVars(text)).toEqual([var_('a', 'REAL')]);
    });

    it('handles CRLF line endings', () => {
        const text = 'PROGRAM p\r\nVAR\r\n    a : BOOL; (* note *)\r\nEND_VAR\r\nEND_PROGRAM\r\n';
        expect(parseLocalVars(text)).toEqual([var_('a', 'BOOL', '', 'note')]);
    });

    it('parses each of the five type subset values', () => {
        const text = [
            'PROGRAM p',
            'VAR',
            '    b : BOOL := TRUE;',
            '    i : INT := -3;',
            '    r : REAL := 1.5;',
            '    t : TIME := T#2s;',
            '    s : STRING := \'hi\';',
            'END_VAR',
            'END_PROGRAM',
        ].join('\n');
        const vars = parseLocalVars(text);
        expect(vars.map((v) => v.type)).toEqual(LOCAL_TYPES);
        expect(vars.map((v) => v.init)).toEqual(['TRUE', '-3', '1.5', 'T#2s', "'hi'"]);
    });

    it('returns empty list when there is no VAR block', () => {
        expect(parseLocalVars('PROGRAM p\nVAR_INPUT\n    x : INT;\nEND_VAR\nEND_PROGRAM')).toEqual([]);
        expect(parseLocalVars('')).toEqual([]);
    });
});

describe('serializeLocalVars (A2-2)', () => {
    it('replaces only the VAR block interior, preserving all other code', () => {
        const original = [
            'PROGRAM Pump',
            'VAR',
            '    old : BOOL;',
            '    (* keep me *)',
            'END_VAR',
            '    running := TRUE;',
            'END_PROGRAM',
        ].join('\n');
        const out = serializeLocalVars(original, [
            var_('running', 'BOOL', 'FALSE', 'pump on'),
            var_('setpoint', 'INT', '50'),
        ]);
        expect(out).toBe(
            'PROGRAM Pump\n' +
            'VAR\n' +
            '    running : BOOL := FALSE; (* pump on *)\n' +
            '    setpoint : INT := 50;\n' +
            'END_VAR\n' +
            '    running := TRUE;\n' +
            'END_PROGRAM',
        );
    });

    it('preserves VAR/END_VAR indentation and keeps later VAR blocks intact', () => {
        const original = [
            'PROGRAM Main',
            '    VAR',
            '    a : BOOL;',
            '    END_VAR',
            'VAR_INPUT',
            '    in : INT;',
            'END_VAR',
            'END_PROGRAM',
        ].join('\n');
        const out = serializeLocalVars(original, [var_('x', 'REAL', '1.0')]);
        expect(out).toBe(
            'PROGRAM Main\n' +
            '    VAR\n' +
            '    x : REAL := 1.0;\n' +
            '    END_VAR\n' +
            'VAR_INPUT\n' +
            '    in : INT;\n' +
            'END_VAR\n' +
            'END_PROGRAM',
        );
    });

    it('returns text unchanged when there is no VAR block', () => {
        const original = 'PROGRAM p\nEND_PROGRAM';
        expect(serializeLocalVars(original, [var_('x', 'BOOL')])).toBe(original);
    });

    it('omits init and comment when empty', () => {
        const original = 'PROGRAM p\nVAR\n    a : BOOL;\nEND_VAR\nEND_PROGRAM';
        const out = serializeLocalVars(original, [var_('x', 'REAL')]);
        expect(out).toContain('    x : REAL;\n');
    });

    it('round-trips through parseLocalVars', () => {
        const original = [
            'PROGRAM p',
            'VAR',
            '    pump : BOOL := FALSE; (* pump on *)',
            '    temp : REAL := 20.0;',
            'END_VAR',
            'END_PROGRAM',
        ].join('\n');
        const vars = parseLocalVars(original);
        expect(parseLocalVars(serializeLocalVars(original, vars))).toEqual(vars);
    });
});