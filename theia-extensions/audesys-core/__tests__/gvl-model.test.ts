import { describe, it, expect } from 'vitest';
import { GVL_TYPES, GvlVariable, parseGvl, serializeGvl } from '../src/browser/gvl-model';

const var_ = (name: string, type: string, init = '', comment = ''): GvlVariable =>
    ({ name, type, init, comment });

describe('parseGvl (A2-1)', () => {
    it('parses a simple VAR_GLOBAL block with name/type/init/comment', () => {
        const text = [
            '(* globals *)',
            '',
            'VAR_GLOBAL',
            '    pump_running : BOOL := FALSE; (* is the pump on *)',
            '    setpoint_k : INT := 50;',
            'END_VAR',
        ].join('\n');
        expect(parseGvl(text)).toEqual([
            var_('pump_running', 'BOOL', 'FALSE', 'is the pump on'),
            var_('setpoint_k', 'INT', '50'),
        ]);
    });

    it('ignores lines outside the VAR_GLOBAL block', () => {
        const text = [
            'FUNCTION f : INT',
            '    x : INT;',
            'END_FUNCTION',
            'VAR_GLOBAL',
            '    g : REAL;',
            'END_VAR',
        ].join('\n');
        expect(parseGvl(text)).toEqual([var_('g', 'REAL')]);
    });

    it('handles CRLF line endings', () => {
        const text = 'VAR_GLOBAL\r\n    a : BOOL; (* note *)\r\nEND_VAR\r\n';
        expect(parseGvl(text)).toEqual([var_('a', 'BOOL', '', 'note')]);
    });

    it('parses each of the five A2-3 type subset values', () => {
        const text = [
            'VAR_GLOBAL',
            '    b : BOOL := TRUE;',
            '    i : INT := -3;',
            '    r : REAL := 1.5;',
            '    t : TIME := T#2s;',
            '    s : STRING := \'hello\';',
            'END_VAR',
        ].join('\n');
        const vars = parseGvl(text);
        expect(vars.map((v) => v.type)).toEqual(GVL_TYPES);
        expect(vars.map((v) => v.init)).toEqual(['TRUE', '-3', '1.5', 'T#2s', "'hello'"]);
    });

    it('skips blank lines and whole-line comments inside the block', () => {
        const text = [
            'VAR_GLOBAL',
            '    (* a header comment *)',
            '',
            '    a : BOOL;',
            'END_VAR',
        ].join('\n');
        expect(parseGvl(text)).toEqual([var_('a', 'BOOL')]);
    });

    it('returns an empty list for text with no VAR_GLOBAL block', () => {
        expect(parseGvl('PROGRAM p\nEND_PROGRAM')).toEqual([]);
        expect(parseGvl('')).toEqual([]);
    });
});

describe('serializeGvl (A2-1)', () => {
    it('emits a VAR_GLOBAL/END_VAR block with declaration lines', () => {
        const out = serializeGvl([
            var_('a', 'BOOL', 'TRUE', 'note'),
            var_('b', 'INT', '7'),
        ]);
        expect(out).toBe(
            'VAR_GLOBAL\n' +
            '    a : BOOL := TRUE; (* note *)\n' +
            '    b : INT := 7;\n' +
            'END_VAR\n',
        );
    });

    it('omits init and comment when empty', () => {
        expect(serializeGvl([var_('x', 'REAL')]))
            .toBe('VAR_GLOBAL\n    x : REAL;\nEND_VAR\n');
    });

    it('round-trips through parseGvl', () => {
        const vars: GvlVariable[] = [
            var_('pump', 'BOOL', 'FALSE', 'pump on'),
            var_('temp', 'REAL', '20.0'),
            var_('tag', 'STRING', "'idle'", 'label'),
        ];
        expect(parseGvl(serializeGvl(vars))).toEqual(vars);
    });
});