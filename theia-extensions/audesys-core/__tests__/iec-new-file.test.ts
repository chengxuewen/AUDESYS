import { describe, it, expect } from 'vitest';
import { IEC_LANG_DIR, nextFileName } from '../src/browser/iec-conventions';

describe('IEC_LANG_DIR (D113 directory convention)', () => {
    it('routes all IEC 61131-3 program languages to Programs/', () => {
        for (const ext of ['.st', '.il', '.ld', '.fbd', '.sfc']) {
            expect(IEC_LANG_DIR[ext]).toBe('Programs');
        }
    });

    it('routes GVL to GVL/, HMI to Hmi/, G-code to Cnc/', () => {
        expect(IEC_LANG_DIR['.gvl']).toBe('GVL');
        expect(IEC_LANG_DIR['.hmi']).toBe('Hmi');
        expect(IEC_LANG_DIR['.gcode']).toBe('Cnc');
    });

    it('covers every new-file extension', () => {
        const exts = ['.st', '.il', '.ld', '.fbd', '.sfc', '.gvl', '.hmi', '.gcode'];
        for (const ext of exts) {
            expect(IEC_LANG_DIR[ext], `missing dir for ${ext}`).toBeTruthy();
        }
    });
});

describe('nextFileName', () => {
    it('returns the plain name when nothing is taken', () => {
        expect(nextFileName(() => false, '.st')).toBe('untitled.st');
    });

    it('increments when the plain name is taken', () => {
        const taken = new Set(['untitled.st']);
        expect(nextFileName((n) => taken.has(n), '.st')).toBe('untitled-1.st');
    });

    it('skips multiple taken names within the same directory', () => {
        const taken = new Set(['untitled.st', 'untitled-1.st', 'untitled-2.st']);
        expect(nextFileName((n) => taken.has(n), '.st')).toBe('untitled-3.st');
    });

    it('honors a custom base name', () => {
        expect(nextFileName(() => false, '.gvl', 'globals')).toBe('globals.gvl');
    });
});