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
    // P2 monitoring: data.active marks the wire as carrying a live signal.
    const active = (props.data as Record<string, unknown> | undefined)?.active === true;
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
        <>
        <BaseEdge
            id={props.id}
            path={path}
            className={active ? 'ld-edge--active' : undefined}
            // Wires are auto-generated decoration — no fat hit area. Branch bus
            // edges run through member columns; their 20px interaction path
            // would swallow clicks on the members themselves.
            interactionWidth={0}
            style={{
                stroke: active
                    ? 'var(--ld-edge-active-color, #ffc107)'
                    : props.selected
                        ? 'var(--ld-selection-color, #2196f3)'
                        : 'var(--ld-wire-color, #666)',
                strokeWidth: active ? 3 : 2,
                // The visible 2px line is decoration only — pointerEvents:
                // none so it never intercepts clicks on the nodes the wire
                // passes through. All wire interaction (hover, right-click
                // context menu) lives on the .ld-edge-interaction path
                // below, which sits BELOW nodes in the stack (edges render
                // before nodes in React Flow), so nodes always win clicks.
                pointerEvents: 'none',
            }}
        />
        {/* Wire interaction surface: a transparent wider hit area that is
            always pointer-events:auto. It renders in the edges layer, which
            React Flow draws BELOW the nodes layer, so hovering/right-clicking
            a node always hits the node — the wire is interactive only in the
            open space between nodes (CODESYS-style edge context menu). */}
        <path
            d={path}
            className="ld-edge-interaction"
            fill="none"
            style={{ pointerEvents: 'auto', stroke: 'transparent', strokeWidth: 14 }}
        />
        </>
    );
};