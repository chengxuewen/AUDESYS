import { describe, it, expect } from 'vitest';
import { classifyToGroups, extOf, PouFileEntry } from '../src/browser/pou-tree-model';
import { findHighlightedFile, findPouGroupOf } from '../src/browser/pou-highlight';

const file = (dir: string, name: string): PouFileEntry => ({
    uri: `file:///workspace/${dir}/${name}`,
    name,
    ext: extOf(name),
});

const groups = () => classifyToGroups([
    file('Programs', 'main.st'),
    file('Programs', 'seq.sfc'),
    file('FBs', 'pid.st'),
    file('GVL', 'globals.gvl'),
]);

describe('findHighlightedFile (A1-3 tree highlight)', () => {
    it('returns the file whose uri matches the active editor uri', () => {
        const gs = groups();
        const hit = findHighlightedFile('file:///workspace/Programs/pid_false.st', []);
        expect(findHighlightedFile('file:///workspace/Programs/main.st', gs)).toEqual(
            expect.objectContaining({ name: 'main.st' }),
        );
        expect(findHighlightedFile('file:///workspace/FBs/pid.st', gs)).toEqual(
            expect.objectContaining({ name: 'pid.st' }),
        );
        expect(hit).toBeNull();
    });

    it('returns null when the active uri belongs to no POU group', () => {
        const gs = groups();
        expect(findHighlightedFile('file:///workspace/docs/notes.st', gs)).toBeNull();
        expect(findHighlightedFile('file:///workspace/README.md', gs)).toBeNull();
    });

    it('returns null for an empty or undefined active uri', () => {
        expect(findHighlightedFile('', groups())).toBeNull();
    });

    it('returns null when there are no groups', () => {
        expect(findHighlightedFile('file:///workspace/Programs/main.st', [])).toBeNull();
    });
});

describe('findPouGroupOf (A1-3 auto-expand)', () => {
    it('returns the owning group for a matching uri', () => {
        const gs = groups();
        expect(findPouGroupOf('file:///workspace/Programs/main.st', gs)?.id).toBe('Programs');
        expect(findPouGroupOf('file:///workspace/GVL/globals.gvl', gs)?.id).toBe('GVL');
    });

    it('returns null for a uri outside any POU group', () => {
        expect(findPouGroupOf('file:///workspace/docs/notes.st', groups())).toBeNull();
        expect(findPouGroupOf('', groups())).toBeNull();
    });
});