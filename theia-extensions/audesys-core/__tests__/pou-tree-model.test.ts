import { describe, it, expect } from 'vitest';
import { classifyToGroups, parentDirName, extOf, POU_GROUP_ORDER, PouFileEntry } from '../src/browser/pou-tree-model';

const file = (dir: string, name: string): PouFileEntry => ({
    uri: `file:///workspace/${dir}/${name}`,
    name,
    ext: extOf(name),
});

describe('parentDirName', () => {
    it('returns the immediate parent directory name', () => {
        expect(parentDirName('file:///workspace/Programs/main.st')).toBe('Programs');
        expect(parentDirName('file:///workspace/FBs/pid.st')).toBe('FBs');
        expect(parentDirName('file:///workspace/')).toBe('');
    });
});

describe('extOf', () => {
    it('extracts the lowercased extension with leading dot', () => {
        expect(extOf('main.st')).toBe('.st');
        expect(extOf('MAIN.ST')).toBe('.st');
        expect(extOf('globals.gvl')).toBe('.gvl');
        expect(extOf('Makefile')).toBe('');
        expect(extOf('.gitignore')).toBe('');
    });
});

describe('classifyToGroups (A1-2 grouping)', () => {
    it('groups Programs files under Programs in first position', () => {
        const groups = classifyToGroups([
            file('Programs', 'main.st'),
            file('Programs', 'seq.sfc'),
        ]);
        expect(groups.map((g) => g.id)).toEqual(['Programs']);
        expect(groups[0].files.map((f) => f.name)).toEqual(['main.st', 'seq.sfc']);
    });

    it('groups FBs and Functions files under their own groups when those dirs exist', () => {
        const groups = classifyToGroups([
            file('Functions', 'scale.fbd'),
            file('FBs', 'pid.st'),
        ]);
        expect(groups.map((g) => g.id)).toEqual(['FBs', 'Functions']);
    });

    it('omits groups whose directory has no files', () => {
        const groups = classifyToGroups([file('Programs', 'main.st')]);
        expect(groups.map((g) => g.id)).toEqual(['Programs']);
        expect(groups.some((g) => g.id === 'GVL')).toBe(false);
    });

    it('routes GVL files to GVL group', () => {
        const groups = classifyToGroups([file('GVL', 'globals.gvl')]);
        expect(groups.map((g) => g.id)).toEqual(['GVL']);
    });

    it('returns all four groups in POU_GROUP_ORDER when all dirs present', () => {
        const groups = classifyToGroups([
            file('Programs', 'main.st'),
            file('FBs', 'pid.st'),
            file('Functions', 'scale.fbd'),
            file('GVL', 'globals.gvl'),
        ]);
        expect(groups.map((g) => g.id)).toEqual(POU_GROUP_ORDER.map((o) => o.id));
    });

    it('ignores files with unrecognized extensions or outside known POU dirs', () => {
        const groups = classifyToGroups([
            file('Programs', 'README.md'),
            file('docs', 'notes.st'),
            file('Hmi', 'screen.hmi'),
        ]);
        expect(groups).toEqual([]);
    });

    it('sorts files within a group by name', () => {
        const groups = classifyToGroups([
            file('Programs', 'zeta.st'),
            file('Programs', 'alpha.il'),
        ]);
        expect(groups[0].files.map((f) => f.name)).toEqual(['alpha.il', 'zeta.st']);
    });
});