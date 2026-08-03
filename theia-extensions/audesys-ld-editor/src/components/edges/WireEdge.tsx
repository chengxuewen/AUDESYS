/**
 * WireEdge — React Flow custom edge for LD horizontal wire connections.
 *
 * Renders a straight line between source and target handle anchors.
 * Both `edge:wire` and `edge:power` model edges are mapped to this
 * type — visually they are identical horizontal conductors.
 */

import React from '@theia/core/shared/react';
import { BaseEdge, getStraightPath, EdgeProps } from '@xyflow/react';

export const WireEdge: React.FC<EdgeProps> = (props) => {
    const [path] = getStraightPath({
        sourceX: props.sourceX,
        sourceY: props.sourceY,
        targetX: props.targetX,
        targetY: props.targetY,
    });

    return (
        <BaseEdge
            id={props.id}
            path={path}
            style={{
                stroke: props.selected
                    ? 'var(--ld-selection-color, #2196f3)'
                    : 'var(--ld-wire-color, #666)',
                strokeWidth: 2,
            }}
        />
    );
};
