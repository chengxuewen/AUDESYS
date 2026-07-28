/**
 * LD GModel Views — GLSP 2.x IView implementations for ladder diagram elements.
 *
 * Each view renders a GLSP GNode/GEdge as SVG elements using snabbdom h().
 * Adapted from the original ld-views.tsx for GLSP 2.x GModel types.
 */
import { VNode } from 'snabbdom';
import { SNodeImpl } from 'sprotty';
export declare class LdContactView {
    render(model: SNodeImpl): VNode;
}
export declare class LdCoilView {
    render(model: SNodeImpl): VNode;
}
export declare class LdPowerRailView {
    render(model: SNodeImpl): VNode;
}
export declare class LdFbView {
    render(model: SNodeImpl): VNode;
}
//# sourceMappingURL=ld-gmodel-views.d.ts.map