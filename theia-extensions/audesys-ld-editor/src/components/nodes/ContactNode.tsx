/**
 * ContactNode — React Flow custom node for an IEC 61131-3 LD contact.
 *
 * SVG ported from the former GLSP LdContactView (ld-gmodel-views.ts):
 * 36×36 box with a horizontal wire line; NO draws a vertical bar,
 * NC a diagonal slash, P/N reuse those shapes with a small marker letter.
 *
 * Handles: target on the left, source on the right, anchored at the
 * symbol's vertical centre (y = 18) so wire edges meet the contact body.
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

export const ContactNode: React.FC<NodeProps> = ({ data, selected }) => {
    const contactType = str(data.contactType, 'NO');
    const variableName = str(data.variableName, '??');
    const isNO = contactType === 'NO' || contactType === 'P';
    const color = isNO
        ? 'var(--ld-contact-no-fill, #4caf50)'
        : 'var(--ld-contact-nc-fill, #f44336)';

    return (
        <div className="ld-contact">
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
                    fill="transparent" stroke={color} strokeWidth={2} rx={4}
                />
                <line
                    x1={6} y1={HALF} x2={CONTACT_SIZE - 6} y2={HALF}
                    stroke={color} strokeWidth={2}
                />
                {isNO ? (
                    <line
                        x1={HALF} y1={6} x2={HALF} y2={CONTACT_SIZE - 6}
                        stroke={color} strokeWidth={2}
                    />
                ) : (
                    <line
                        x1={HALF} y1={6} x2={CONTACT_SIZE - 6} y2={CONTACT_SIZE - 6}
                        stroke={color} strokeWidth={2}
                    />
                )}
                {(contactType === 'P' || contactType === 'N') && (
                    <text
                        x={CONTACT_SIZE - 4} y={10}
                        textAnchor="end" fontSize={9} fill={color}
                    >
                        {contactType}
                    </text>
                )}
            </svg>
            <div className="ld-node-label">{variableName}</div>
            <Handle type="target" position={Position.Left} id="in" style={HANDLE_STYLE} />
            <Handle type="source" position={Position.Right} id="out" style={HANDLE_STYLE} />
        </div>
    );
};
