/**
 * WireEdge — React Flow custom edge for LD horizontal wire connections.
 *
 * Renders a straight line between source and target handle anchors.
 * Both `edge:wire` and `edge:power` model edges are mapped to this
 * type — visually they are identical horizontal conductors.
 */

import React from '@theia/core/shared/react';
import { BaseEdge, getSmoothStepPath, getStraightPath, EdgeProps } from '@xyflow/react';

/**
 * WireEdge - React Flow custom edge for LD wire connections.
 *
 * Straight horizontal for series wires (same y) — smooth-step degenerates
 * into a loop over the adjacent node when handles nearly touch, and its
 * 20px interaction path then intercepts clicks on that node.
 * L-shaped (smooth-step) for parallel-branch wires (different y).
 */
export const WireEdge: React.FC<EdgeProps> = (props) => {
    const sameRow = props.sourceY === props.targetY;
    const [path] = sameRow
        ? getStraightPath({
            sourceX: props.sourceX,
            sourceY: props.sourceY,
            targetX: props.targetX,
            targetY: props.targetY,
        })
        : getSmoothStepPath({
            sourceX: props.sourceX,
            sourceY: props.sourceY,
            sourcePosition: props.sourcePosition,
            targetX: props.targetX,
            targetY: props.targetY,
            targetPosition: props.targetPosition,
        });
    return (
        <BaseEdge
            id={props.id}
            path={path}
            // Wires are auto-generated decoration — no fat hit area. Branch bus
            // edges run through member columns; their 20px interaction path
            // would swallow clicks on the members themselves.
            interactionWidth={0}
            style={{
                stroke: props.selected
                    ? 'var(--ld-selection-color, #2196f3)'
                    : 'var(--ld-wire-color, #666)',
                strokeWidth: 2,
                pointerEvents: 'none',
            }}
        />
    );
};
