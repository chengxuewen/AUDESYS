/**
 * LD Sprotty Views — IView implementations for ladder diagram elements.
 *
 * Each view renders its corresponding SModel element as an SVG element
 * using snabbdom's virtual DOM (`h()` function).
 *
 * CSS variables are reused from the existing LD editor theme
 * (injected by LdEditorWidget.injectCssContent).
 */
import { VNode } from 'snabbdom';
import { IView, RenderingContext, SNode } from 'sprotty';
export declare class LdContactView implements IView {
    render(model: Readonly<SNode>, context: RenderingContext): VNode | undefined;
}
export declare class LdCoilView implements IView {
    render(model: Readonly<SNode>, context: RenderingContext): VNode | undefined;
}
export declare class LdPowerRailView implements IView {
    render(model: Readonly<SNode>, context: RenderingContext): VNode | undefined;
}
export declare class LdFbView implements IView {
    render(model: Readonly<SNode>, context: RenderingContext): VNode | undefined;
}
//# sourceMappingURL=ld-views.d.ts.map