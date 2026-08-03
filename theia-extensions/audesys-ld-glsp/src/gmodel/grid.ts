/**
 * LD Grid Constants — single source of truth for layout/grid values.
 *
 * All constants are multiples of LD_GRID (40) so elements snap cleanly:
 *   - CONTACT_SIZE 36  = 1 cell (4px gap on each side)
 *   - RUNG_HEIGHT  80  = 2 cells
 *   - COIL_X_OFFSET 600 = 15 cells
 *   - RAIL_X_RIGHT  640 = 16 cells
 *
 * GridSnapper (client) and snapToGrid (server) both use LD_GRID.
 */
export const LD_GRID = { x: 40, y: 40 } as const;

/** Contact/coil node size (both dimensions). */
export const CONTACT_SIZE = 36;

/** Rung height — 2 grid cells. */
export const RUNG_HEIGHT = 80;

/** Rung group container height (4px gap below rung). */
export const RUNG_GROUP_HEIGHT = RUNG_HEIGHT - 4;

/** Power rail stroke width. */
export const RAIL_WIDTH = 4;

/** Fixed horizontal offset of the coil area (left rail to coil zone). */
export const COIL_X_OFFSET = 600;

/** Right power rail x position = coil offset + contact size + rail width. */
export const RAIL_X_RIGHT = COIL_X_OFFSET + CONTACT_SIZE + RAIL_WIDTH;

/** Rung group container width (right rail + right padding). */
export const RUNG_GROUP_WIDTH = RAIL_X_RIGHT + 160;
