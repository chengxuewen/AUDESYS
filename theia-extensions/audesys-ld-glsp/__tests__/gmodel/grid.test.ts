/**
 * T4.2: Grid constant tests — all LD layout constants must be multiples of
 * LD_GRID (40) so elements snap cleanly. Regression guard.
 */
import { describe, it, expect } from 'vitest';
import {
    LD_GRID,
    CONTACT_SIZE,
    RUNG_HEIGHT,
    RUNG_GROUP_HEIGHT,
    RAIL_WIDTH,
    COIL_X_OFFSET,
    RAIL_X_RIGHT,
    RUNG_GROUP_WIDTH,
} from '../../src/gmodel/grid';

describe('LD grid constants (40×40 compatibility)', () => {
    const GRID = LD_GRID.x;

    it('grid is 40×40', () => {
        expect(LD_GRID).toEqual({ x: 40, y: 40 });
    });

    it('rung height is 2 grid cells (80)', () => {
        expect(RUNG_HEIGHT % GRID).toBe(0);
        expect(RUNG_HEIGHT).toBe(80);
    });

    it('coil x offset is 15 grid cells (600)', () => {
        expect(COIL_X_OFFSET % GRID).toBe(0);
        expect(COIL_X_OFFSET).toBe(600);
    });

    it('right rail x is 16 grid cells (640)', () => {
        expect(RAIL_X_RIGHT % GRID).toBe(0);
        expect(RAIL_X_RIGHT).toBe(640);
    });

    it('contact size fits within one cell (36 < 40)', () => {
        expect(CONTACT_SIZE).toBeLessThan(GRID);
        expect(CONTACT_SIZE).toBe(36);
    });

    it('rung group dimensions derive from rung height', () => {
        expect(RUNG_GROUP_HEIGHT).toBe(RUNG_HEIGHT - 4);
        expect(RUNG_GROUP_WIDTH % GRID).toBe(0);
    });

    it('rail width is 1/10 of grid (thin line)', () => {
        expect(RAIL_WIDTH).toBe(4);
    });
});
