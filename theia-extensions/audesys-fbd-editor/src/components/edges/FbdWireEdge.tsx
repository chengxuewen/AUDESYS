/**
 * FbdWireEdge — React Flow custom edge for FBD signal wires.
 *
 * Port-to-port connections render as bezier curves (getBezierPath) —
 * the standard look for FBD signal flow between output and input pins.
 */

import React from '@theia/core/shared/react';
import { BaseEdge, getBezierPath, EdgeProps } from '@xyflow/react';

export const FbdWireEdge: React.FC<EdgeProps> = (props) => {
    const [path] = getBezierPath({
        sourceX: props.sourceX,
        sourceY: props.sourceY,
        targetX: props.targetX,
        targetY: props.targetY,
        sourcePosition: props.sourcePosition,
        targetPosition: props.targetPosition,
    });

    return (
        <BaseEdge
            id={props.id}
            path={path}
            style={{
                stroke: props.selected
                    ? 'var(--fbd-selection-color, #4caf50)'
                    : 'var(--fbd-wire-color, #888)',
                strokeWidth: 2,
                fill: 'none',
            }}
        />
    );
};
