/**
 * RungGroupNode — React Flow custom node acting as a rung container.
 *
 * Child nodes (contacts, coils) reference this node via `parentId` +
 * `extent: 'parent'`; React Flow nests them inside this wrapper div.
 * The group itself is not draggable — its y position is derived from
 * the rung index by graphToFlow.
 */

import React from '@theia/core/shared/react';
import { NodeProps } from '@xyflow/react';

const num = (v: unknown, fallback: number): number =>
    typeof v === 'number' ? v : fallback;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export const RungGroupNode: React.FC<NodeProps> = ({ data, selected }) => {
    const rungNumber = num(data.rungNumber, 0);
    const comment = str(data.comment);

    return (
        <div className={`ld-rung-group${selected ? ' ld-rung-group--selected' : ''}`}>
            <div className="ld-rung-group__label">
                {String(rungNumber).padStart(3, '0')}
                {comment ? ` — ${comment}` : ''}
            </div>
        </div>
    );
};
