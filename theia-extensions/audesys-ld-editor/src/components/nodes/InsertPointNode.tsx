/**
 * InsertPointNode — CODESYS-style diamond insertion marker (D112).
 *
 * Rendered on every legal series slot of a rung while a tool is active:
 * gray diamond, turns green on hover. Branch members use a green marker
 * (active insert target). Clicking places the pending tool's element at
 * `data.insertIndex` of `data.rungId` (handled in LdCanvas onNodeClick,
 * not here — this node is purely visual + click target).
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
    const d = data as InsertPointData;
    const isBranchMarker = typeof d.branchAnchorId === 'string' && !!d.branchAnchorId;
    const hovered = selected === true;
    // Branch markers are ACTIVE insert targets (green by default); series-slot
    // insert points are idle (gray) until hovered. The status hint tells the
    // user to click the "green marker" below a contact, so it must render green.
    const background = hovered || isBranchMarker
        ? 'var(--ld-insert-hover, #4caf50)'
        : 'var(--ld-insert-color, #9e9e9e)';
    return (
        <div
            className={`ld-insert-point${hovered ? ' ld-insert-point--hover' : ''}`}
            style={{
                width: DIAMOND,
                height: DIAMOND,
                transform: `rotate(45deg)`, // diamond
                background,
                borderRadius: 2,
                cursor: 'crosshair',
                pointerEvents: 'auto',
            }}
            title={isBranchMarker ? 'Click to add a branch member' : 'Click to insert here'}
        />
    );
};
