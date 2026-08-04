/**
 * Grid layout invariants — power rails must frame the rung container.
 *
 * Regression guard (2026-08-04): RUNG_GROUP_WIDTH was RAIL_X_RIGHT + 160
 * (GLSP-era "right padding"), so the right rail rendered mid-container
 * instead of at the container's right edge. The container now hugs the
 * right rail: right edge == rail x + rail stroke width.
 */
import { describe, it, expect } from 'vitest';
import {
    LD_GRID, CONTACT_SIZE, RUNG_HEIGHT, RUNG_GROUP_HEIGHT,
    RAIL_WIDTH, COIL_X_OFFSET, RAIL_X_RIGHT, RUNG_GROUP_WIDTH,
} from '../model/grid';

describe('grid layout invariants (rail-frame rung)', () => {
    it('right rail sits at coil zone + contact size + stroke (x=640)', () => {
        expect(RAIL_X_RIGHT).toBe(COIL_X_OFFSET + CONTACT_SIZE + RAIL_WIDTH);
        expect(RAIL_X_RIGHT).toBe(640);
    });

    it('rung container right edge hugs the right rail (no phantom padding)', () => {
        // Regression: was RAIL_X_RIGHT + 160 → rail floated mid-container.
        expect(RUNG_GROUP_WIDTH).toBe(RAIL_X_RIGHT + RAIL_WIDTH);
    });

    it('container is exactly as wide as the rail span', () => {
        // Left rail at 0, right rail at 640 (stroke 4) → container 0..644.
        expect(RUNG_GROUP_WIDTH - RAIL_WIDTH).toBe(RAIL_X_RIGHT);
        expect(RUNG_GROUP_WIDTH).toBe(644);
    });

    it('coil zone stays inside the container with room for the coil node', () => {
        // Coil at COIL_X_OFFSET, 36px wide → ends at 636 < right rail 640.
        expect(COIL_X_OFFSET + CONTACT_SIZE).toBeLessThan(RAIL_X_RIGHT);
    });

    it('all constants stay on the 40px grid', () => {
        expect(COIL_X_OFFSET % LD_GRID.x).toBe(0);
        expect(RAIL_X_RIGHT % LD_GRID.x).toBe(0);
        expect(RUNG_HEIGHT % LD_GRID.y).toBe(0);
        expect(RUNG_GROUP_HEIGHT).toBe(RUNG_HEIGHT - 4);
    });
});
