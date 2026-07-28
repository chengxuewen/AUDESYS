/**
 * Unit tests for LD GModel views — LdContactView, LdCoilView, LdPowerRailView, LdFbView.
 *
 * Each view renders a GLSP SNodeImpl as a snabbdom VNode tree.
 * Tests verify the VNode structure: tag, attrs, and children.
 */
import { describe, it, expect } from 'vitest';
import { VNode } from 'snabbdom';
import { SNodeImpl } from 'sprotty';
import {
    LdContactView,
    LdCoilView,
    LdPowerRailView,
    LdFbView,
} from '../../src/client/ld-gmodel-views';

// ============================================================================
// Mock helpers
// ============================================================================

/** Create a minimal SNodeImpl mock with the fields our views access. */
function mockNode(overrides: {
    id?: string;
    position?: { x: number; y: number };
    size?: { width: number; height: number };
    args?: Record<string, unknown>;
    cssClasses?: string[];
}): SNodeImpl {
    const node = new SNodeImpl();
    node.id = overrides.id ?? 'mock-node';
    node.position = overrides.position ?? { x: 0, y: 0 };
    if (overrides.size !== undefined) {
        node.size = overrides.size;
    } else {
        // ponytail: delete SNodeImpl's default {-1,-1} size so ?? fallbacks fire
        delete (node as any).size;
    }
    (node as any).args = overrides.args ?? {};
    (node as any).cssClasses = overrides.cssClasses ?? [];
    return node;
    return node;
}

/** Find a direct child VNode by selector (tag or .class). */
function findChild(vnode: VNode, sel: string): VNode | undefined {
    return vnode.children?.find(
        (c): c is VNode => typeof c === 'object' && 'sel' in c && c.sel === sel,
    );
}

/** Find a child VNode by tag and data-element-id attribute. */
function findChildByElementId(
    vnode: VNode,
    tag: string,
    elementId: string,
): VNode | undefined {
    return vnode.children?.find(
        (c): c is VNode =>
            typeof c === 'object' &&
            'sel' in c &&
            c.sel === tag &&
            (c.data?.attrs as any)?.['data-element-id'] === elementId,
    );
}

/** Count child VNodes matching a selector. */
function countChildren(vnode: VNode, sel: string): number {
    return (
        vnode.children?.filter(
            (c): c is VNode => typeof c === 'object' && 'sel' in c && c.sel === sel,
        ).length ?? 0
    );
}

/** Shortcut: find a child by tag, then pull its attrs. */
function childAttrs(vnode: VNode, sel: string): Record<string, unknown> {
    const child = findChild(vnode, sel);
    expect(child, `expected child ${sel} to exist`).toBeDefined();
    return (child!.data?.attrs ?? {}) as Record<string, unknown>;
}

// ============================================================================
// LdContactView
// ============================================================================

describe('LdContactView', () => {
    const view = new LdContactView();

    it('renders a default NO contact with variable name and body elements', () => {
        const model = mockNode({
            id: 'contact-1',
            position: { x: 100, y: 40 },
            args: { contactType: 'NO', variableName: 'X1' },
        });

        const vnode = view.render(model);

        // Root is a <g> element
        expect(vnode.sel).toBe('g');
        expect(vnode.data?.attrs).toMatchObject({ id: 'contact-1' });

        // Body: rect, horizontal line, vertical line (NO), text label
        expect(countChildren(vnode, 'rect')).toBe(1);
        expect(countChildren(vnode, 'line')).toBe(2);
        expect(countChildren(vnode, 'text')).toBe(1);

        // No selection highlight when not selected
        expect(childAttrs(vnode, 'rect')).toMatchObject({
            x: 100 + 18 - 18, // cx - HALF = 100+18-18
            y: 40 + 18 - 18,
            width: 36,
            height: 36,
            fill: 'transparent',
        });
    });

    it('renders selection highlight rect when selected', () => {
        const model = mockNode({
            id: 'contact-sel',
            position: { x: 100, y: 40 },
            args: { contactType: 'NC', variableName: 'X2' },
            cssClasses: ['selected'],
        });

        const vnode = view.render(model);

        // Selected -> 2 rects (selection highlight + body)
        expect(countChildren(vnode, 'rect')).toBe(2);
        // NC -> 1 horizontal + 1 diagonal = 2 lines
        expect(countChildren(vnode, 'line')).toBe(2);

        // First rect is the selection highlight (dashed)
        const rects = vnode.children!.filter(
            (c): c is VNode => typeof c === 'object' && 'sel' in c && c.sel === 'rect',
        );
        const selRect = rects[0];
        expect(selRect.data?.attrs).toMatchObject({
            fill: 'none',
            'stroke-dasharray': '4 2',
        });
    });
});

// ============================================================================
// LdCoilView
// ============================================================================

describe('LdCoilView', () => {
    const view = new LdCoilView();

    it('renders a default Normal coil with rounded rect body and variable label', () => {
        const model = mockNode({
            id: 'coil-1',
            position: { x: 300, y: 40 },
            args: { coilType: 'Normal', variableName: 'Y1' },
        });

        const vnode = view.render(model);

        expect(vnode.sel).toBe('g');
        expect(vnode.data?.attrs).toMatchObject({ id: 'coil-1' });

        // Normal coil: 1 rect (rounded), 1 text label
        expect(countChildren(vnode, 'rect')).toBe(1);
        expect(countChildren(vnode, 'text')).toBe(1);

        // Rounded rect (rx = 18)
        const rectAttrs = childAttrs(vnode, 'rect');
        expect(rectAttrs).toMatchObject({
            rx: 18,
            width: 36,
            height: 36,
        });
    });

    it('renders Set coil with "S" text indicator', () => {
        const model = mockNode({
            id: 'coil-set',
            position: { x: 300, y: 40 },
            args: { coilType: 'Set', variableName: 'Y1' },
        });

        const vnode = view.render(model);

        // Set coil: 1 rect + "S" text + variable label = 2 text
        const textNodes = vnode.children!.filter(
            (c): c is VNode => typeof c === 'object' && 'sel' in c && c.sel === 'text',
        );
        expect(textNodes).toHaveLength(2);

        // First text is "S" (bold indicator)
        expect(textNodes[0].text).toBe('S');
        expect(textNodes[0].data?.attrs).toMatchObject({
            'font-weight': 'bold',
            'font-size': 14,
        });

        // Second text is variable name
        expect(textNodes[1].text).toBe('Y1');
    });

    it('renders selection highlight rect when selected', () => {
        const model = mockNode({
            id: 'coil-sel',
            position: { x: 300, y: 40 },
            args: { coilType: 'Normal', variableName: 'Y1' },
            cssClasses: ['selected'],
        });

        const vnode = view.render(model);

        expect(countChildren(vnode, 'rect')).toBe(2);
        expect(countChildren(vnode, 'text')).toBe(1);
    });

    it('renders Negated coil with diagonal line', () => {
        const model = mockNode({
            id: 'coil-neg',
            position: { x: 300, y: 40 },
            args: { coilType: 'Negated', variableName: 'Y2' },
        });

        const vnode = view.render(model);

        // Negated: 1 rect + 1 diagonal line + 1 text
        expect(countChildren(vnode, 'rect')).toBe(1);
        expect(countChildren(vnode, 'line')).toBe(1);
        expect(countChildren(vnode, 'text')).toBe(1);
    });
});

// ============================================================================
// LdPowerRailView
// ============================================================================

describe('LdPowerRailView', () => {
    const view = new LdPowerRailView();

    it('renders a left power rail as a vertical line from position to height', () => {
        const model = mockNode({
            id: 'powerrail-left',
            position: { x: 0, y: 0 },
            size: { width: 4, height: 600 },
            args: { side: 'Left' },
        });

        const vnode = view.render(model);

        expect(vnode.sel).toBe('line');
        expect(vnode.data?.attrs).toMatchObject({
            id: 'powerrail-left',
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 600,
            'stroke-width': 4,
            'stroke-linecap': 'round',
        });
    });

    it('renders a right power rail with correct positioning', () => {
        const model = mockNode({
            id: 'powerrail-right',
            position: { x: 0, y: 0 },
            size: { width: 4, height: 400 },
            args: { side: 'Right' },
        });

        const vnode = view.render(model);

        expect(vnode.sel).toBe('line');
        expect(vnode.data?.attrs).toMatchObject({
            id: 'powerrail-right',
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 400,
            'stroke-width': 4,
        });
    });

    it('defaults to 400px height when size is missing', () => {
        const model = mockNode({
            id: 'powerrail-default',
            position: { x: 0, y: 0 },
            // size intentionally omitted — defaults to 400
            args: { side: 'Left' },
        });

        const vnode = view.render(model);

        expect(vnode.data?.attrs).toMatchObject({
            y2: 400,
        });
    });
});

// ============================================================================
// LdFbView
// ============================================================================

describe('LdFbView', () => {
    const view = new LdFbView();

    it('renders a function block with body rect and type label', () => {
        const model = mockNode({
            id: 'fb-1',
            position: { x: 200, y: 80 },
            size: { width: 120, height: 80 },
            args: { fbType: 'TON' },
        });

        const vnode = view.render(model);

        expect(vnode.sel).toBe('g');
        expect(vnode.data?.attrs).toMatchObject({ id: 'fb-1' });

        // FB body rect + text label
        expect(countChildren(vnode, 'rect')).toBe(1);
        expect(countChildren(vnode, 'text')).toBe(1);

        // Body rect styling
        const rectAttrs = childAttrs(vnode, 'rect');
        expect(rectAttrs).toMatchObject({
            x: 200,
            y: 80,
            width: 120,
            height: 80,
            rx: 6,
        });
    });

    it('renders selection highlight rect when selected', () => {
        const model = mockNode({
            id: 'fb-sel',
            position: { x: 200, y: 80 },
            size: { width: 120, height: 80 },
            args: { fbType: 'CTU' },
            cssClasses: ['selected'],
        });

        const vnode = view.render(model);

        // 2 rects: selection highlight + body
        expect(countChildren(vnode, 'rect')).toBe(2);
        expect(countChildren(vnode, 'text')).toBe(1);

        // First rect is the selection highlight (dashed)
        const rects = vnode.children!.filter(
            (c): c is VNode => typeof c === 'object' && 'sel' in c && c.sel === 'rect',
        );
        expect(rects[0].data?.attrs).toMatchObject({
            fill: 'none',
            'stroke-dasharray': '4 2',
        });
    });

    it('renders text label with the fbType name', () => {
        const model = mockNode({
            id: 'fb-label',
            position: { x: 200, y: 80 },
            size: { width: 120, height: 80 },
            args: { fbType: 'TMR' },
        });

        const vnode = view.render(model);

        const textNode = findChild(vnode, 'text');
        expect(textNode).toBeDefined();
        expect(textNode!.text).toBe('TMR');
        expect(textNode!.data?.attrs).toMatchObject({
            'text-anchor': 'middle',
            'font-weight': 'bold',
        });
    });
});