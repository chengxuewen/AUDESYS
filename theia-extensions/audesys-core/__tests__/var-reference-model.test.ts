import { describe, it, expect } from 'vitest';
import {
    extractProgramBody,
    extractVarReferences,
    findUndeclaredRefs,
} from '../src/browser/var-reference-model';

describe('extractProgramBody (A2-4)', () => {
    it('takes the statements between END_VAR and END_PROGRAM', () => {
        const text = [
            'PROGRAM Pump',
            'VAR',
            '    a : BOOL;',
            'END_VAR',
            '    a := TRUE;',
            '    setpoint := 50;',
            'END_PROGRAM',
        ].join('\n');
        expect(extractProgramBody(text)).toBe('    a := TRUE;\n    setpoint := 50;');
    });

    it('starts after the PROGRAM header when there is no VAR block', () => {
        const text = ['PROGRAM Main', '    x := 1;', 'END_PROGRAM'].join('\n');
        expect(extractProgramBody(text)).toBe('    x := 1;');
    });

    it('returns empty body for an empty/no-body program', () => {
        expect(extractProgramBody('PROGRAM p\nVAR\n    a : BOOL;\nEND_VAR\nEND_PROGRAM'))
            .toBe('');
        expect(extractProgramBody('')).toBe('');
    });
});

describe('extractVarReferences (A2-4)', () => {
    it('extracts identifiers used in assignments/expressions', () => {
        const code = [
            '    running := TRUE;',
            '    temp := temp * 2.0;',
            '    setpoint := setpoint + offset;',
        ].join('\n');
        expect(extractVarReferences(code)).toEqual(['running', 'temp', 'setpoint', 'offset']);
    });

    it('filters keywords and base types', () => {
        const code = [
            '    IF running AND NOT stopped THEN',
            '        temp := INT;',
            '    END_IF;',
            '    FOR i := 1 TO 10 DO',
            '        x := x + 1;',
            '    END_FOR;',
        ].join('\n');
        const refs = extractVarReferences(code);
        expect(refs).not.toContain('IF');
        expect(refs).not.toContain('AND');
        expect(refs).not.toContain('NOT');
        expect(refs).not.toContain('THEN');
        expect(refs).not.toContain('END_IF');
        expect(refs).not.toContain('FOR');
        expect(refs).not.toContain('TO');
        expect(refs).not.toContain('DO');
        expect(refs).not.toContain('END_FOR');
        expect(refs).not.toContain('INT');
        expect(refs).toContain('running');
        expect(refs).toContain('stopped');
        expect(refs).toContain('i');
        expect(refs).toContain('x');
    });

    it('ignores identifiers inside string literals', () => {
        const code = ["    msg := 'IF running';", '    held := TRUE;'].join('\n');
        expect(extractVarReferences(code)).toEqual(['msg', 'held']);
    });

    it('ignores identifiers inside block comments', () => {
        const code = ['    (* use running and temp *)', '    out := in;'].join('\n');
        expect(extractVarReferences(code)).toEqual(['out', 'in']);
    });

    it('excludes time-literal prefixes (T#, TIME#, D#, DT#)', () => {
        const code = ['    t1 := T#2s;', '    t2 := TIME#5s;', '    d := D#2026-01-01;']
            .join('\n');
        expect(extractVarReferences(code)).toEqual(['t1', 't2', 'd']);
    });

    it('returns unique names in first-appearance order', () => {
        const code = ['    a := b;', '    c := a;', '    d := b;'].join('\n');
        expect(extractVarReferences(code)).toEqual(['a', 'b', 'c', 'd']);
    });

    it('returns empty when the body has no identifiers', () => {
        expect(extractVarReferences('')).toEqual([]);
        expect(extractVarReferences("    (* nothing *)")).toEqual([]);
    });
});

describe('findUndeclaredRefs (A2-4)', () => {
    it('flags body references not declared in the VAR block', () => {
        const code = ['    running := TRUE;', '    setpoint := setpoint + offset;'].join('\n');
        // running is declared; setpoint and offset are not.
        expect(findUndeclaredRefs(code, ['running'])).toEqual(['setpoint', 'offset']);
    });

    it('returns empty when every reference is declared', () => {
        const code = '    a := a + b;';
        expect(findUndeclaredRefs(code, ['a', 'b'])).toEqual([]);
    });

    it('returns every reference when nothing is declared', () => {
        const code = '    a := b;';
        expect(findUndeclaredRefs(code, [])).toEqual(['a', 'b']);
    });

    it('keeps unique undeclared names in first-appearance order', () => {
        const code = ['    x := missing;', '    y := missing;', '    present := x;'].join('\n');
        expect(findUndeclaredRefs(code, ['present', 'x', 'y'])).toEqual(['missing']);
    });
});