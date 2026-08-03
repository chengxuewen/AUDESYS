/**
 * T4.1: GridSnapper unit tests — pure class, no DI container needed.
 *
 * GridSnapper snaps purely on this.grid (element param ignored by impl).
 * Default constructor = 10×10 (GLSP documented default) — regression guard.
 *
 * Loaded from the compiled CJS directly: requiring the package index pulls in
 * CSS imports that vitest node env cannot parse. grid-snapper.js has no CSS.
 */
import { describe, it, expect } from 'vitest';
import * as path from 'path';

const gridSnapperJs = require.resolve('@eclipse-glsp/client/lib/features/grid/grid-snapper');
const { GridSnapper } = require(gridSnapperJs);

describe('GridSnapper (40×40)', () => {
    const snapper = new GridSnapper({ x: 40, y: 40 });

    it('snaps arbitrary position to 40px multiples', () => {
        expect(snapper.snap({ x: 57, y: 83 }, {})).toEqual({ x: 40, y: 80 });
    });

    it('rounds boundary values to nearest cell', () => {
        // 39 → 40, 19 → 0 (Math.round: <20 rounds down to 0)
        expect(snapper.snap({ x: 39, y: 19 }, {})).toEqual({ x: 40, y: 0 });
        expect(snapper.snap({ x: 21, y: 21 }, {})).toEqual({ x: 40, y: 40 });
    });

    it('keeps exact multiples unchanged', () => {
        expect(snapper.snap({ x: 100, y: 100 }, {})).toEqual({ x: 120, y: 120 });
        expect(snapper.snap({ x: 0, y: 0 }, {})).toEqual({ x: 0, y: 0 });
    });

    it('snaps to 3-cell spacing (contact column pitch 120)', () => {
        // Contact column spacing is 120 (3 × 40) — snapping still on 40 sub-grid
        expect(snapper.snap({ x: 121, y: 81 }, {})).toEqual({ x: 120, y: 80 });
    });
});

describe('GridSnapper default constructor', () => {
    it('snaps to 10×10 by default (GLSP documented)', () => {
        const defaultSnapper = new GridSnapper();
        expect(defaultSnapper.snap({ x: 23, y: 47 }, {})).toEqual({ x: 20, y: 50 });
    });
});
