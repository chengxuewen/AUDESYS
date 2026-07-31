/**
 * FBD GModel Views — GLSP 2.x IView implementations for function block diagram elements.
 *
 * Each view renders a GLSP GNode/GPort as SVG elements using snabbdom h().
 *
 * Key difference from LD: FBD views render GPort children for pin-level connections.
 * - FbdGateView: renders 5 gate types (AND/OR/XOR/NOT/MUX) with GPort children
 * - FbdFbView: renders FunctionBlockNode with dynamic pin list via renderChildren()
 * - FbdPortView: renders GPort as colored circle with pin name label
 */
import { VNode, h } from 'snabbdom';
import { GNode, GPort, IView, RenderingContext } from '@eclipse-glsp/client';
import { injectable } from '@theia/core/shared/inversify';

// ============================================================================
// Shared Layout Constants
// ============================================================================

const PORT_RADIUS = 5;
const GATE_SIZE = 60;

// CSS variable references (injected by fbd-css-inject.ts or Theia theme)
const C = {
    gateFill: 'var(--fbd-gate-fill, #37474f)',
    gateStroke: 'var(--fbd-gate-stroke, #4caf50)',
    gateLabel: 'var(--fbd-gate-label-color, #fff)',
    fbFill: 'var(--fbd-fb-fill, #263238)',
    fbStroke: 'var(--fbd-fb-stroke, #4caf50)',
    fbLabel: 'var(--fbd-fb-label-color, #fff)',
    portInput: 'var(--fbd-port-input-fill, #4caf50)',
    portOutput: 'var(--fbd-port-output-fill, #2196f3)',
    portBidi: 'var(--fbd-port-bidi-fill, #ff9800)',
    portLabel: 'var(--fbd-port-label-color, #888)',
    selection: 'var(--fbd-selection-color, #2196f3)',
} as const;

// ============================================================================
// Helpers
// ============================================================================

/** Read a property from a GLSP GModel element (args or properties). */
function getArg<T = string>(model: GNode | GPort, key: string, defaultValue: T): T {
    const args = (model as any).args;
    if (args && key in args) return args[key] as T;
    return defaultValue;
}

/** Check if element is selected (has the 'selected' CSS class). */
function isSelected(model: GNode | GPort): boolean {
    return (model as any).cssClasses?.includes('selected') ?? false;
}

// ============================================================================
// Gate View — AND / OR / XOR / NOT / MUX
// ============================================================================

@injectable()
export class FbdGateView implements IView {
    render(model: Readonly<GNode>, context: RenderingContext): VNode | undefined {
        const { x, y } = model.position;
        const gateType = getArg(model, 'gateType', 'AND');
        const nodeW = model.size?.width ?? GATE_SIZE;
        const nodeH = model.size?.height ?? GATE_SIZE;
        const selected = isSelected(model);

        const children: VNode[] = [];

        // Selection highlight
        if (selected) {
            children.push(h('rect', {
                attrs: {
                    x: x - 4, y: y - 4,
                    width: nodeW + 8, height: nodeH + 8,
                    fill: 'none', stroke: C.selection,
                    'stroke-width': 2, 'stroke-dasharray': '4 2',
                },
            }));
        }

        // Gate shape (IEC 61131-3 standard symbols)
        children.push(renderGateShape(x, y, nodeW, nodeH, gateType));

        // Gate type label
        children.push(h('text', {
            attrs: {
                x: x + nodeW / 2, y: y + nodeH / 2 + 4,
                'text-anchor': 'middle', 'font-size': 12,
                fill: C.gateLabel, 'font-weight': 'bold',
            },
        }, gateType));

        // Render GPort children (pins)
        children.push(...context.renderChildren(model));

        return h('g', { attrs: { id: model.id } }, children);
    }
}

/** Render gate shape SVG based on gate type (IEC 61131-3). */
function renderGateShape(x: number, y: number, nodeW: number, nodeH: number, gateType: string): VNode {
    switch (gateType) {
        case 'AND':
            // D-shape: rectangle with rounded right side
            return h('path', {
                attrs: {
                    d: `M${x},${y} L${x + nodeW * 0.6},${y} A${nodeW * 0.4},${nodeH / 2} 0 0,1 ${x + nodeW * 0.6},${y + nodeH} L${x},${y + nodeH} Z`,
                    fill: C.gateFill, stroke: C.gateStroke, 'stroke-width': 2,
                },
            });
        case 'OR':
            // Curved shield shape
            return h('path', {
                attrs: {
                    d: `M${x},${y} Q${x + nodeW * 0.5},${y} ${x + nodeW},${y + nodeH / 2} Q${x + nodeW * 0.5},${y + nodeH} ${x},${y + nodeH} Q${x + nodeW * 0.3},${y + nodeH / 2} ${x},${y} Z`,
                    fill: C.gateFill, stroke: C.gateStroke, 'stroke-width': 2,
                },
            });
        case 'XOR':
            // OR shape + extra curve
            return h('g', {}, [
                h('path', {
                    attrs: {
                        d: `M${x},${y} Q${x + nodeW * 0.5},${y} ${x + nodeW},${y + nodeH / 2} Q${x + nodeW * 0.5},${y + nodeH} ${x},${y + nodeH} Q${x + nodeW * 0.3},${y + nodeH / 2} ${x},${y} Z`,
                        fill: C.gateFill, stroke: C.gateStroke, 'stroke-width': 2,
                    },
                }),
                h('path', {
                    attrs: {
                        d: `M${x - 6},${y} Q${x + nodeW * 0.3 - 6},${y + nodeH / 2} ${x - 6},${y + nodeH}`,
                        fill: 'none', stroke: C.gateStroke, 'stroke-width': 2,
                    },
                }),
            ]);
        case 'NOT':
            // Triangle + circle at output
            return h('g', {}, [
                h('path', {
                    attrs: {
                        d: `M${x},${y} L${x + nodeW * 0.7},${y + nodeH / 2} L${x},${y + nodeH} Z`,
                        fill: C.gateFill, stroke: C.gateStroke, 'stroke-width': 2,
                    },
                }),
                h('circle', {
                    attrs: {
                        cx: x + nodeW * 0.7 + 8, cy: y + nodeH / 2, r: 8,
                        fill: 'none', stroke: C.gateStroke, 'stroke-width': 2,
                    },
                }),
            ]);
        case 'MUX':
            // Trapezoid with selection input
            return h('path', {
                attrs: {
                    d: `M${x + nodeW * 0.2},${y} L${x + nodeW * 0.8},${y} L${x + nodeW},${y + nodeH} L${x},${y + nodeH} Z`,
                    fill: C.gateFill, stroke: C.gateStroke, 'stroke-width': 2,
                },
            });
        default:
            // Fallback: rectangle
            return h('rect', {
                attrs: {
                    x, y, width: nodeW, height: nodeH,
                    fill: C.gateFill, stroke: C.gateStroke, 'stroke-width': 2, rx: 4,
                },
            });
    }
}

// ============================================================================
// Function Block View — with renderChildren() for GPort
// ============================================================================

@injectable()
export class FbdFbView implements IView {
    render(model: Readonly<GNode>, context: RenderingContext): VNode | undefined {
        const { x, y } = model.position;
        const fbType = getArg(model, 'fbType', 'FB');
        const nodeW = model.size?.width ?? 120;
        const nodeH = model.size?.height ?? 60;
        const selected = isSelected(model);

        const children: VNode[] = [];

        // Selection highlight
        if (selected) {
            children.push(h('rect', {
                attrs: {
                    x: x - 4, y: y - 4,
                    width: nodeW + 8, height: nodeH + 8,
                    fill: 'none', stroke: C.selection,
                    'stroke-width': 2, 'stroke-dasharray': '4 2',
                },
            }));
        }

        // FB rectangle
        children.push(h('rect', {
            attrs: {
                x, y, width: nodeW, height: nodeH,
                fill: C.fbFill, stroke: C.fbStroke,
                'stroke-width': 2, rx: 6,
            },
        }));

        // FB type label
        children.push(h('text', {
            attrs: {
                x: x + nodeW / 2, y: y + nodeH / 2 + 4,
                'text-anchor': 'middle', 'font-size': 12,
                fill: C.fbLabel, 'font-weight': 'bold',
            },
        }, fbType));

        // Render GPort children (pins) — CRITICAL for port visibility
        children.push(...context.renderChildren(model));

        return h('g', { attrs: { id: model.id } }, children);
    }
}

// ============================================================================
// Port View — colored circle with pin name label
// ============================================================================

@injectable()
export class FbdPortView implements IView {
    render(model: Readonly<GPort>, context: RenderingContext): VNode | undefined {
        const { x, y } = model.position;
        const pinDirection = getArg(model, 'pinDirection', 'Input');
        const pinName = getArg(model, 'pinName', '');
        const selected = isSelected(model);

        // Color by direction
        const color = pinDirection === 'Input' ? C.portInput :
                      pinDirection === 'Output' ? C.portOutput :
                      C.portBidi;  // Bidi

        const children: VNode[] = [];

        // Selection highlight
        if (selected) {
            children.push(h('circle', {
                attrs: {
                    cx: x, cy: y, r: PORT_RADIUS + 3,
                    fill: 'none', stroke: C.selection,
                    'stroke-width': 2, 'stroke-dasharray': '3 1',
                },
            }));
        }

        // Port circle
        children.push(h('circle', {
            attrs: {
                cx: x, cy: y, r: PORT_RADIUS,
                fill: color, stroke: '#fff',
                'stroke-width': 1,
            },
        }));

        // Pin name label (below port)
        if (pinName) {
            children.push(h('text', {
                attrs: {
                    x, y: y + PORT_RADIUS + 12,
                    'text-anchor': 'middle', 'font-size': 9,
                    fill: C.portLabel,
                },
            }, pinName));
        }

        return h('g', { attrs: { id: model.id } }, children);
    }
}
