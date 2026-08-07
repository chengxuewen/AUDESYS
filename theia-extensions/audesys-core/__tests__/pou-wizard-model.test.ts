import { describe, it, expect } from 'vitest';
import {
    POU_TYPES, PouType, PouLanguage,
    languagesFor, pouTarget, validatePouName,
} from '../src/browser/pou-wizard-model';

describe('POU types & languages (A1-4)', () => {
    it('exposes the four POU types in a stable order', () => {
        expect(POU_TYPES).toEqual(['Program', 'FunctionBlock', 'Function', 'GVL']);
    });

    it('offers ST/IL for Program, FunctionBlock and Function', () => {
        for (const type of ['Program', 'FunctionBlock', 'Function'] as const) {
            expect(languagesFor(type)).toEqual(['ST', 'IL']);
        }
    });

    it('offers only GVL for the GVL type', () => {
        expect(languagesFor('GVL')).toEqual(['GVL']);
    });
});

describe('pouTarget (type + language → dir/ext/template)', () => {
    it('routes Program to Programs/ with .st', () => {
        const t = pouTarget('Program', 'ST');
        expect(t.dir).toBe('Programs');
        expect(t.ext).toBe('.st');
        expect(t.template('Main')).toContain('PROGRAM Main');
        expect(t.template('Main')).toContain('END_PROGRAM');
    });

    it('routes Program/IL to Programs/ with .il', () => {
        const t = pouTarget('Program', 'IL');
        expect(t.dir).toBe('Programs');
        expect(t.ext).toBe('.il');
    });

    it('routes FunctionBlock to FBs/ with FUNCTION_BLOCK template', () => {
        const t = pouTarget('FunctionBlock', 'ST');
        expect(t.dir).toBe('FBs');
        expect(t.ext).toBe('.st');
        expect(t.template('PID')).toContain('FUNCTION_BLOCK PID');
        expect(t.template('PID')).toContain('END_FUNCTION_BLOCK');
    });

    it('routes Function to Functions/ with FUNCTION template', () => {
        const t = pouTarget('Function', 'ST');
        expect(t.dir).toBe('Functions');
        expect(t.ext).toBe('.st');
        expect(t.template('Scale')).toContain('FUNCTION Scale : RET');
        expect(t.template('Scale')).toContain('END_FUNCTION');
    });

    it('routes GVL to GVL/ with .gvl and VAR_GLOBAL template', () => {
        const t = pouTarget('GVL', 'GVL');
        expect(t.dir).toBe('GVL');
        expect(t.ext).toBe('.gvl');
        expect(t.template('Globals')).toContain('VAR_GLOBAL');
        expect(t.template('Globals')).toContain('END_VAR');
    });

    it('every type/language combination resolves to a non-empty dir/ext', () => {
        for (const type of POU_TYPES) {
            for (const lang of languagesFor(type)) {
                const t = pouTarget(type as PouType, lang as PouLanguage);
                expect(t.dir, `${type}/${lang} dir`).toBeTruthy();
                expect(t.ext, `${type}/${lang} ext`).toBeTruthy();
                expect(t.template('X'), `${type}/${lang} template`).toContain('X');
            }
        }
    });
});

describe('validatePouName', () => {
    it('accepts letter/underscore start and alnum/underscore body', () => {
        for (const name of ['Main', '_temp', 'PID_Controller', 'SV_1', 'a']) {
            expect(validatePouName(name), name).toBe(true);
        }
    });

    it('rejects invalid identifiers', () => {
        for (const name of ['', '1Main', 'my-pou', 'my pou', 'my.pou', 'a b']) {
            expect(validatePouName(name), name).toBe(false);
        }
    });
});