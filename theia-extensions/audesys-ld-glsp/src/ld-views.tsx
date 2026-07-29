/**
 * LD Sprotty Views — IView implementations for ladder diagram elements.
 *
 * Each view renders its corresponding SModel element as an SVG element
 * using snabbdom's virtual DOM (`h()` function).
 *
 * CSS variables are reused from the existing LD editor theme
 * (injected by LdEditorWidget.injectCssContent).
 */

import { VNode, h } from 'snabbdom';
import { injectable } from '@theia/core/shared/inversify';
import {
    IView,
    RenderingContext,
    SNode,
    SEdge,
    SPort,
    SGraph,
    Point,
    getBasicType,
    getSubType,
} from 'sprotty';

// ============================================================================
// Shared Layout Constants (match ld-editor-widget.tsx + ld-operation-handler.ts)
// ============================================================================

const CONTACT_SIZE = 36;
const HALF = CONTACT_SIZE / 2;
const RAIL_WIDTH = 4;
const RUNG_OFFSET = 80;
const CANVAS_PADDING = 40;

// ponytail: inline CSS variable references, no style module import needed.
const C = {
    powerRail: 'var(--ld-power-rail-color, #2196f3)',
    contactNo: 'var(--ld-contact-no-fill, #4caf50)',
    contactNc: 'var(--ld-contact-nc-fill, #f44336)',
    coilNormal: 'var(--ld-coil-normal-fill, #4caf50)',
    coilSet: 'var(--ld-coil-set-fill, #ff9800)',
    coilReset: 'var(--ld-coil-reset-fill, #f44336)',
    label: 'var(--ld-rung-label-color, #888)',
    selection: 'var(--ld-selection-color, #2196f3)',
    wire: 'var(--ld-wire-color, #666)',
    grid: 'var(--ld-grid-color, #333)',
    fbFill: 'var(--ld-fb-fill, #37474f)',
    fbStroke: 'var(--ld-fb-stroke, #4caf50)',
} as const;

// ============================================================================
// Contact View — NO / NC
// ============================================================================

@injectable()
export class LdContactView implements IView {
    render(model: Readonly<SNode>, context: RenderingContext): VNode | undefined {
        const { x, y } = model.position;
        const contactType = getElementProp(model, 'contactType', 'NO');
        const variableName = getElementProp(model, 'variableName', '??');
        const isSelected = getElementProp(model, 'selected', false);
        const isNO = contactType === 'NO';
        const color = isNO ? C.contactNo : C.contactNc;
        const cx = x + HALF;
        const cy = y + HALF;

        const children: VNode[] = [];

        // Selection highlight rect
        if (isSelected) {
            children.push(h('rect', {
                attrs: {
                    x: cx - HALF - 4, y: cy - HALF - 4,
                    width: CONTACT_SIZE + 8, height: CONTACT_SIZE + 8,
                    fill: 'none', stroke: C.selection,
                    'stroke-width': 2, 'stroke-dasharray': '4 2',
                },
            }));
        }

        // Contact body
        children.push(h('rect', {
            attrs: {
                x: cx - HALF, y: cy - HALF,
                width: CONTACT_SIZE, height: CONTACT_SIZE,
                fill: 'transparent',
                stroke: color,
                'stroke-width': 2,
                rx: 4,
            },
        }));

        // Horizontal line
        children.push(h('line', {
            attrs: {
                x1: cx - HALF + 6, y1: cy,
                x2: cx + HALF - 6, y2: cy,
                stroke: color, 'stroke-width': 2,
            },
        }));

        // Vertical line for NO, diagonal for NC
        if (isNO) {
            children.push(h('line', {
                attrs: {
                    x1: cx, y1: cy - HALF + 6,
                    x2: cx, y2: cy + HALF - 6,
                    stroke: color, 'stroke-width': 2,
                },
            }));
        } else {
            children.push(h('line', {
                attrs: {
                    x1: cx, y1: cy - HALF + 6,
                    x2: cx + HALF - 6, y2: cy + HALF - 6,
                    stroke: color, 'stroke-width': 2,
                },
            }));
        }

        // Label
        children.push(h('text', {
            attrs: {
                x: cx, y: cy + HALF + 14,
                'text-anchor': 'middle', 'font-size': 10,
                fill: C.label,
            },
        }, variableName));

        return h('g', { attrs: { id: model.id, 'data-element-id': model.id } }, children);
    }
}

// ============================================================================
// Coil View — Normal / Negated / Set / Reset
// ============================================================================

@injectable()
export class LdCoilView implements IView {
    render(model: Readonly<SNode>, context: RenderingContext): VNode | undefined {
        const { x, y } = model.position;
        const coilType = getElementProp(model, 'coilType', 'Normal');
        const variableName = getElementProp(model, 'variableName', '??');
        const isSelected = getElementProp(model, 'selected', false);
        const cx = x + HALF;
        const cy = y + HALF;

        const coilColor =
            coilType === 'Normal' ? C.coilNormal :
            coilType === 'Set' ? C.coilSet :
            coilType === 'Reset' ? C.coilReset :
            C.coilNormal;

        const children: VNode[] = [];

        // Selection highlight
        if (isSelected) {
            children.push(h('rect', {
                attrs: {
                    x: cx - HALF - 4, y: cy - HALF - 4,
                    width: CONTACT_SIZE + 8, height: CONTACT_SIZE + 8,
                    fill: 'none', stroke: C.selection,
                    'stroke-width': 2, 'stroke-dasharray': '4 2',
                },
            }));
        }

        // Coil body (rounded rect)
        children.push(h('rect', {
            attrs: {
                x: cx - HALF, y: cy - HALF,
                width: CONTACT_SIZE, height: CONTACT_SIZE,
                fill: 'transparent',
                stroke: coilColor,
                'stroke-width': 2,
                rx: 18,
            },
        }));

        // Type indicator
        if (coilType === 'Negated') {
            children.push(h('line', {
                attrs: {
                    x1: cx - HALF + 6, y1: cy + HALF - 6,
                    x2: cx + HALF - 6, y2: cy - HALF + 6,
                    stroke: coilColor, 'stroke-width': 1.5,
                },
            }));
        } else if (coilType === 'Set') {
            children.push(h('text', {
                attrs: {
                    x: cx, y: cy + 5,
                    'text-anchor': 'middle', 'font-size': 14,
                    'font-weight': 'bold', fill: coilColor,
                },
            }, 'S'));
        } else if (coilType === 'Reset') {
            children.push(h('text', {
                attrs: {
                    x: cx, y: cy + 5,
                    'text-anchor': 'middle', 'font-size': 14,
                    'font-weight': 'bold', fill: coilColor,
                },
            }, 'R'));
        }

        // Label
        children.push(h('text', {
            attrs: {
                x: cx, y: cy + HALF + 14,
                'text-anchor': 'middle', 'font-size': 10,
                fill: C.label,
            },
        }, variableName));

        return h('g', { attrs: { id: model.id, 'data-element-id': model.id } }, children);
    }
}

// ============================================================================
// Power Rail View — Left / Right vertical line
// ============================================================================

@injectable()
export class LdPowerRailView implements IView {
    render(model: Readonly<SNode>, context: RenderingContext): VNode | undefined {
        const { x, y } = model.position;
        const side = getElementProp(model, 'side', 'Left');
        const railX = side === 'Left'
            ? CANVAS_PADDING
            : CANVAS_PADDING + 600 + CONTACT_SIZE + RAIL_WIDTH;
        const totalHeight = Math.max(
            (model.size?.height || 400) - CANVAS_PADDING,
            400,
        );

        return h('line', {
            attrs: {
                id: model.id,
                'data-element-id': model.id,
                x1: railX, y1: CANVAS_PADDING,
                x2: railX, y2: totalHeight,
                stroke: C.powerRail,
                'stroke-width': RAIL_WIDTH,
                'stroke-linecap': 'round',
            },
        });
    }
}

// ============================================================================
// Function Block View
// ============================================================================

@injectable()
export class LdFbView implements IView {
    render(model: Readonly<SNode>, context: RenderingContext): VNode | undefined {
        const { x, y } = model.position;
        const fbType = getElementProp(model, 'fbType', 'FB');
        const w = 120;
        const h = Math.max(
            40 + (getElementProp<number>(model, 'pinCount', 4)) * 16,
            60,
        );
        const isSelected = getElementProp(model, 'selected', false);

        const children: VNode[] = [];

        // Selection highlight
        if (isSelected) {
            children.push(h('rect', {
                attrs: {
                    x: x - 4, y: y - 4,
                    width: w + 8, height: h + 8,
                    fill: 'none', stroke: C.selection,
                    'stroke-width': 2, 'stroke-dasharray': '4 2',
                },
            }));
        }

        // FB body
        children.push(h('rect', {
            attrs: {
                x, y,
                width: w, height: h,
                fill: C.fbFill,
                stroke: C.fbStroke,
                'stroke-width': 2,
                rx: 6,
            },
        }));

        // Type label
        children.push(h('text', {
            attrs: {
                x: x + w / 2, y: y + h / 2 + 4,
                'text-anchor': 'middle', 'font-size': 12,
                fill: C.fbStroke, 'font-weight': 'bold',
            },
        }, fbType));

        return h('g', { attrs: { id: model.id, 'data-element-id': model.id } }, children);
    }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Read a property from the model's element.
 *
 * Properties are stored on the model-element instance, either as direct
 * `model.prop` (SProtty pattern) or in `model.properties` (GLSP pattern).
 * We check both.
 */
function getElementProp<T = string>(
    model: Readonly<SNode | SEdge | SGraph>,
    prop: string,
    defaultValue: T,
): T {
    // ponytail: try own property first, then prototype chain via index access
    const m = model as Record<string, unknown>;
    if (prop in m && m[prop] !== undefined) {
        return m[prop] as T;
    }
    return defaultValue;
}
