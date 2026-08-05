/**
 * PowerRailNode — React Flow custom node for a full-height power rail.
 *
 * Renders a vertical line spanning all rungs. The left rail exposes a
 * source handle; the right rail a target handle, both at mid-height,
 * so wire edges from/to rung elements anchor correctly.
 *
 * The node's pixel height is passed via `data.height` (also set as the
 * node style height by graphToFlow, so handles land at 50%).
 */

import React from '@theia/core/shared/react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { RAIL_WIDTH } from '../../model/grid';

const num = (v: unknown, fallback: number): number =>
    typeof v === 'number' && v > 0 ? v : fallback;

/** Invisible but functional edge anchor (default vertical centre). */
const HANDLE_STYLE: React.CSSProperties = {
    width: 8,
    height: 8,
    minWidth: 0,
    minHeight: 0,
    background: 'transparent',
    border: 'none',
    zIndex: 2,
};

/**
 * Per-rung row entry: where to place a handle on the rail so a rung's
 * wire anchors at the rung's main-row height instead of the rail midpoint.
 * `y` is absolute within the rail node (which sits at y=0, full height).
 */
interface RailRow {
    rungId: string;
    y: number;
}

export const PowerRailNode: React.FC<NodeProps> = ({ data, selected }) => {
    const side = data.side === 'Right' ? 'Right' : 'Left';
    const railHeight = num(data.height, 400);
    const rows = (data.rows as RailRow[] | undefined) ?? [];
    const stroke = selected
        ? 'var(--ld-selection-color, #2196f3)'
        : 'var(--ld-power-rail-color, #2196f3)';

    return (
        <div className="ld-powerrail">
            <svg width={RAIL_WIDTH} height={railHeight}>
                <line
                    x1={RAIL_WIDTH / 2} y1={0}
                    x2={RAIL_WIDTH / 2} y2={railHeight}
                    stroke={stroke} strokeWidth={RAIL_WIDTH} strokeLinecap="round"
                />
            </svg>
            {side === 'Left'
                ? rows.map((r) => (
                    <Handle key={r.rungId} type="source" position={Position.Right}
                        id={`rail:${r.rungId}`} style={{ ...HANDLE_STYLE, top: r.y }} />
                ))
                : rows.map((r) => (
                    <Handle key={r.rungId} type="target" position={Position.Left}
                        id={`rail:${r.rungId}`} style={{ ...HANDLE_STYLE, top: r.y }} />
                ))}
        </div>
    );
};
