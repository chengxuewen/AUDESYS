/**
 * CoilNode — React Flow custom node for an IEC 61131-3 LD coil.
 *
 * SVG ported from the former GLSP LdCoilView (ld-gmodel-views.ts):
 * 36×36 circle (rx = 18). Negated draws a diagonal slash, Set an "S",
 * Reset an "R". Normal is a plain circle.
 *
 * Handles: target on the left, source on the right, anchored at the
 * symbol's vertical centre (y = 18).
 */

import React from '@theia/core/shared/react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { CONTACT_SIZE } from '../../model/grid';

const HALF = CONTACT_SIZE / 2;

/** Invisible but functional edge anchor. */
const HANDLE_STYLE: React.CSSProperties = {
    width: 8,
    height: 8,
    minWidth: 0,
    minHeight: 0,
    background: 'transparent',
    border: 'none',
    top: HALF,
};

const str = (v: unknown, fallback: string): string =>
    typeof v === 'string' && v.length > 0 ? v : fallback;

export const CoilNode: React.FC<NodeProps> = ({ data, selected }) => {
    const coilType = str(data.coilType, 'Normal');
    const variableName = str(data.variableName, '??');
    const color =
        coilType === 'Set' ? 'var(--ld-coil-set-fill, #ff9800)' :
        coilType === 'Reset' ? 'var(--ld-coil-reset-fill, #f44336)' :
        'var(--ld-coil-normal-fill, #4caf50)';

    return (
        <div className="ld-coil">
            <svg width={CONTACT_SIZE} height={CONTACT_SIZE}>
                {selected && (
                    <rect
                        x={-4} y={-4}
                        width={CONTACT_SIZE + 8} height={CONTACT_SIZE + 8}
                        fill="none" stroke="var(--ld-selection-color, #2196f3)"
                        strokeWidth={2} strokeDasharray="4 2"
                    />
                )}
                <rect
                    x={0} y={0}
                    width={CONTACT_SIZE} height={CONTACT_SIZE}
                    fill="transparent" stroke={color} strokeWidth={2} rx={HALF}
                />
                {coilType === 'Negated' && (
                    <line
                        x1={6} y1={CONTACT_SIZE - 6} x2={CONTACT_SIZE - 6} y2={6}
                        stroke={color} strokeWidth={1.5}
                    />
                )}
                {(coilType === 'Set' || coilType === 'Reset') && (
                    <text
                        x={HALF} y={HALF + 5}
                        textAnchor="middle" fontSize={14} fontWeight="bold" fill={color}
                    >
                        {coilType === 'Set' ? 'S' : 'R'}
                    </text>
                )}
            </svg>
            <div className="ld-node-label">{variableName}</div>
            <Handle type="target" position={Position.Left} id="in" style={HANDLE_STYLE} />
            <Handle type="source" position={Position.Right} id="out" style={HANDLE_STYLE} />
        </div>
    );
};
