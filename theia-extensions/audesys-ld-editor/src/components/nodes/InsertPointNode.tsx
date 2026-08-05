/**
 * InsertPointNode — CODESYS-style diamond insertion marker (D112).
 *
 * Rendered on every legal series slot of a rung while a tool is active:
 * gray diamond, turns green on hover. Clicking places the pending tool's
 * element at `data.insertIndex` of `data.rungId` (handled in LdCanvas
 * onNodeClick, not here — this node is purely visual + click target).
 *
 * Not draggable, not selectable, never persists into the model.
 */
import React from '@theia/core/shared/react';
import { NodeProps } from '@xyflow/react';

export interface InsertPointData extends Record<string, unknown> {
    /** Rung id the slot belongs to. */
    rungId: string;
    /** Insertion slot index in the rung's elementIds (series placement). */
    insertIndex?: number;
    /** Anchor contact id (branch placement — marker below the anchor). */
    branchAnchorId?: string;
}

const DIAMOND = 14;

export const InsertPointNode: React.FC<NodeProps> = ({ data, selected }) => {
    const hovered = selected === true;
    return (
        <div
            className={`ld-insert-point${hovered ? ' ld-insert-point--hover' : ''}`}
            style={{
                width: DIAMOND,
                height: DIAMOND,
                transform: `rotate(45deg)`, // diamond
                background: hovered ? 'var(--ld-insert-hover, #4caf50)' : 'var(--ld-insert-color, #9e9e9e)',
                borderRadius: 2,
                cursor: 'crosshair',
                pointerEvents: 'auto',
            }}
            title="Click to insert here"
        />
    );
};
