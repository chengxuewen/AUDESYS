/**
 * LD GModel Views — GLSP 2.x IView implementations for ladder diagram elements.
 *
 * Each view renders a GLSP GNode/GEdge as SVG elements using snabbdom h().
 * Adapted from the original ld-views.tsx for GLSP 2.x GModel types.
 */
import { VNode, h } from 'snabbdom';
import { SNodeImpl, IView, RenderingContext } from '@eclipse-glsp/sprotty';
import { injectable } from '@theia/core/shared/inversify';


// ============================================================================
// Shared Layout Constants
// ============================================================================

const CONTACT_SIZE = 36;
const HALF = CONTACT_SIZE / 2;
const RAIL_WIDTH = 4;

// CSS variable references (injected by ld-css-inject.ts or Theia theme)
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
    fbFill: 'var(--ld-fb-fill, #37474f)',
    fbStroke: 'var(--ld-fb-stroke, #4caf50)',
} as const;

// ============================================================================
// Helpers
// ============================================================================

/** Read a property from a GLSP GModel element (args or properties). */
function getArg<T = string>(model: SNodeImpl, key: string, defaultValue: T): T {
    const args = (model as any).args;
    if (args && key in args) return args[key] as T;
    return defaultValue;
}

/** Check if element is selected (has the 'selected' CSS class). */
function isSelected(model: SNodeImpl): boolean {
    return (model as any).cssClasses?.includes('selected') ?? false;
}

// ============================================================================
// Contact View — NO / NC
// ============================================================================

@injectable()
export class LdContactView implements IView {
    render(model: Readonly<SNodeImpl>, context: RenderingContext): VNode | undefined {
        const { x, y } = model.position;
        const contactType = getArg(model, 'contactType', 'NO');
        const variableName = getArg(model, 'variableName', '??');
        const selected = isSelected(model);
        const isNO = contactType === 'NO';
        const color = isNO ? C.contactNo : C.contactNc;
        const cx = x + HALF;
        const cy = y + HALF;

        const children: VNode[] = [];

        if (selected) {
            children.push(h('rect', {
                attrs: {
                    x: cx - HALF - 4, y: cy - HALF - 4,
                    width: CONTACT_SIZE + 8, height: CONTACT_SIZE + 8,
                    fill: 'none', stroke: C.selection,
                    'stroke-width': 2, 'stroke-dasharray': '4 2',
                },
            }));
        }

        children.push(h('rect', {
            attrs: {
                x: cx - HALF, y: cy - HALF,
                width: CONTACT_SIZE, height: CONTACT_SIZE,
                fill: 'transparent', stroke: color,
                'stroke-width': 2, rx: 4,
            },
        }));

        children.push(h('line', {
            attrs: {
                x1: cx - HALF + 6, y1: cy,
                x2: cx + HALF - 6, y2: cy,
                stroke: color, 'stroke-width': 2,
            },
        }));

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

        children.push(h('text', {
            attrs: {
                x: cx, y: cy + HALF + 14,
                'text-anchor': 'middle', 'font-size': 10,
                fill: C.label,
            },
        }, variableName));

        return h('g', { attrs: { id: model.id } }, children);
    }
}

// ============================================================================
// Coil View — Normal / Negated / Set / Reset
// ============================================================================

@injectable()
export class LdCoilView implements IView {
    render(model: Readonly<SNodeImpl>, context: RenderingContext): VNode | undefined {
        const { x, y } = model.position;
        const coilType = getArg(model, 'coilType', 'Normal') as string;
        const variableName = getArg(model, 'variableName', '??');
        const selected = isSelected(model);
        const cx = x + HALF;
        const cy = y + HALF;

        const coilColor =
            coilType === 'Normal' ? C.coilNormal :
            coilType === 'Set' ? C.coilSet :
            coilType === 'Reset' ? C.coilReset :
            C.coilNormal;

        const children: VNode[] = [];

        if (selected) {
            children.push(h('rect', {
                attrs: {
                    x: cx - HALF - 4, y: cy - HALF - 4,
                    width: CONTACT_SIZE + 8, height: CONTACT_SIZE + 8,
                    fill: 'none', stroke: C.selection,
                    'stroke-width': 2, 'stroke-dasharray': '4 2',
                },
            }));
        }

        children.push(h('rect', {
            attrs: {
                x: cx - HALF, y: cy - HALF,
                width: CONTACT_SIZE, height: CONTACT_SIZE,
                fill: 'transparent', stroke: coilColor,
                'stroke-width': 2, rx: 18,
            },
        }));

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

        children.push(h('text', {
            attrs: {
                x: cx, y: cy + HALF + 14,
                'text-anchor': 'middle', 'font-size': 10,
                fill: C.label,
            },
        }, variableName));

        return h('g', { attrs: { id: model.id } }, children);
    }
}

// ============================================================================
// Power Rail View — Left / Right vertical line
// ============================================================================

@injectable()
export class LdPowerRailView implements IView {
    render(model: Readonly<SNodeImpl>, context: RenderingContext): VNode | undefined {
        const { x, y } = model.position;
        const side = getArg(model, 'side', 'Left');
        const totalHeight = model.size?.height ?? 400;

        return h('line', {
            attrs: {
                id: model.id,
                x1: x, y1: y,
                x2: x, y2: y + totalHeight,
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
    render(model: Readonly<SNodeImpl>, context: RenderingContext): VNode | undefined {
        const { x, y } = model.position;
        const fbType = getArg(model, 'fbType', 'FB');
        const w = model.size?.width ?? 120;
        const fbHeight = model.size?.height ?? 60;
        const selected = isSelected(model);

        const children: VNode[] = [];

        if (selected) {
            children.push(h('rect', {
                attrs: {
                    x: x - 4, y: y - 4,
                    width: w + 8, height: fbHeight + 8,
                    fill: 'none', stroke: C.selection,
                    'stroke-width': 2, 'stroke-dasharray': '4 2',
                },
            }));
        }

        children.push(h('rect', {
            attrs: {
                x, y, width: w, height: fbHeight,
                fill: C.fbFill, stroke: C.fbStroke,
                'stroke-width': 2, rx: 6,
            },
        }));

        children.push(h('text', {
            attrs: {
                x: x + w / 2, y: y + fbHeight / 2 + 4,
                'text-anchor': 'middle', 'font-size': 12,
                fill: C.fbStroke, 'font-weight': 'bold',
            },
        }, fbType));

        return h('g', { attrs: { id: model.id } }, children);
    }
}
