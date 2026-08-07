/**
 * A4 — Project compile pure-logic tests.
 *
 * Verifies `mapProjectResultToMarkers` turns a ProjectCompileResult into
 * per-file markers, parsing "at line N, col M" from each error message.
 */
import { describe, expect, test } from 'vitest';
import { ProjectCompileResult } from '../src/common/st-compile-protocol';
import {
    compileKindForPath, mapProjectResultToMarkers, parsePosition,
} from '../src/browser/st-project-compile';

describe('parsePosition', () => {
    test('extracts line and column', () => {
        expect(parsePosition('parse error: unexpected token at line 3, col 5')).toEqual({ line: 3, column: 5 });
    });

    test('defaults column to 1 when only line present', () => {
        expect(parsePosition('error at line 7')).toEqual({ line: 7, column: 1 });
    });

    test('returns null when no position', () => {
        expect(parsePosition('codegen error: undefined variable')).toBeNull();
    });

    test('returns null on empty message', () => {
        expect(parsePosition('')).toBeNull();
    });
});

describe('compileKindForPath', () => {
    test('routes .il to il compiler', () => {
        expect(compileKindForPath('file:///w/Programs/main.il')).toBe('il');
    });
    test('route check is case-insensitive', () => {
        expect(compileKindForPath('file:///w/Programs/main.IL')).toBe('il');
    });
    test('routes .st (and anything else) to st compiler', () => {
        expect(compileKindForPath('file:///w/Programs/main.st')).toBe('st');
        expect(compileKindForPath('file:///w/Programs/main.txt')).toBe('st');
    });
});

describe('mapProjectResultToMarkers', () => {
    test('maps only failing files, parsing position', () => {
        const result: ProjectCompileResult = {
            results: [
                { path: 'file:///w/Programs/a.st', ok: true, message: '' },
                { path: 'file:///w/Programs/b.st', ok: false, message: 'parse error at line 3, col 5' },
                { path: 'file:///w/FBs/c.il', ok: false, message: 'codegen error: undefined variable x' },
            ],
        };
        const markers = mapProjectResultToMarkers(result);
        expect(markers.size).toBe(2);
        expect(markers.get('file:///w/Programs/b.st')).toEqual([{
            line: 3, column: 5, message: 'parse error at line 3, col 5', severity: 'Error',
        }]);
        // No position → marker on line 1 col 1.
        expect(markers.get('file:///w/FBs/c.il')).toEqual([{
            line: 1, column: 1, message: 'codegen error: undefined variable x', severity: 'Error',
        }]);
    });

    test('returns empty map when all files compile', () => {
        const result: ProjectCompileResult = {
            results: [{ path: 'file:///w/Programs/a.st', ok: true, message: '' }],
        };
        expect(mapProjectResultToMarkers(result).size).toBe(0);
    });

    test('returns empty map for empty result', () => {
        expect(mapProjectResultToMarkers({ results: [] }).size).toBe(0);
    });
});