/**
 * HmiCanvasWidget — Lumino Widget wrapping the react-rnd HMI canvas.
 *
 * Implements C1-C8 conflict resolutions per the Lumino conflict spec:
 *   C1: position:relative inner div as stable coordinate origin
 *   C2: native mousedown capture-phase interception
 *   C3: CSS contain:layout+style + z-index override
 *   C4: overscroll-behavior:contain + wheel block in edit mode
 *   C7: debounced resize via requestAnimationFrame
 *
 * Reference: docs/plans/t3p5-lumino-conflict-resolution.md §2.2
 */
import { Widget } from "@lumino/widgets";
import { Message } from "@lumino/messaging";
import type { HmiWidgetState, HmiWidgetType } from "../types/hmi";
export interface HmiCanvasWidgetProps {
    widgets: HmiWidgetState[];
    selectedWidgetId: string | null;
    editMode: boolean;
    onSelectWidget: (id: string | null) => void;
    onUpdateWidget: (id: string, patch: Partial<HmiWidgetState>) => void;
    onRemoveWidget: (id: string) => void;
    onAddWidget: (type: HmiWidgetType, label: string) => void;
    onCanvasResize?: (size: {
        width: number;
        height: number;
    }) => void;
}
export declare class HmiCanvasWidget extends Widget {
    private canvasDiv;
    private reactRoot;
    private props;
    private nativeMouseDownBound;
    private wheelBound;
    private _resizeRafId;
    private _lastWidth;
    private _lastHeight;
    constructor(props: HmiCanvasWidgetProps);
    protected onAfterAttach(msg: Message): void;
    protected onBeforeDetach(msg: Message): void;
    protected onResize(msg: Widget.ResizeMessage): void;
    /**
     * C2: Intercept mousedown before Lumino's tab drag handler.
     * If target is an Rnd child, stop propagation so Lumino never sees it.
     */
    private handleNativeMouseDown;
    /**
     * C4: Block wheel scroll in Edit mode, allow in Preview.
     */
    private handleWheel;
    updateProps(patch: Partial<HmiCanvasWidgetProps>): void;
    /** Get the canvas div for coordinate calculations. */
    getCanvasDiv(): HTMLDivElement;
}
//# sourceMappingURL=hmi-canvas-widget.d.ts.map