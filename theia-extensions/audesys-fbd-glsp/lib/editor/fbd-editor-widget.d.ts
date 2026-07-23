/**
 * FBD Editor Widget — SVG-based function block diagram renderer.
 *
 * Renders the FbdGraph model as an interactive SVG canvas. Supports:
 * - Logic gates (AND=half-circle, OR=pointed arc, NOT=triangle+circle,
 *   XOR=pointed arc "=1", MUX=trapezoid)
 * - Function block instances (rectangles with pin dots)
 * - Signal wires (orthogonal line segments with 90° bends)
 * - Click-to-select with visual feedback
 * - Tool-mode click to create new elements
 * - Right-click context menu (Delete, Change Gate Type, Compile)
 * - Grid snap (20px)
 *
 * Ponytail: plain SVG + React state. No canvas libs, no GLSP server.
 */
import React from 'react';
import { Message } from '@lumino/messaging';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { FbdToolState } from '../tool-palette/fbd-tool-state';
import { FbdGModelState } from '../server/fbd-gmodel-state';
import { FbdOperationHandler, CompileResult } from '../server/fbd-operation-handler';
export interface FbdEditorSelection {
    elementId: string;
    elementType: string;
}
export declare class FbdEditorWidget extends ReactWidget {
    static readonly ID = "audesys-fbd-editor";
    static readonly LABEL = "Function Block Diagram";
    private readonly toolState;
    private readonly modelState;
    private readonly handler;
    private onSelectionChange?;
    private _dirty;
    private _compileResult;
    constructor(toolState: FbdToolState, modelState: FbdGModelState, handler: FbdOperationHandler);
    get dirty(): boolean;
    get compileResult(): CompileResult | null;
    setSelectionCallback(fn: (sel: FbdEditorSelection | null) => void): void;
    protected onAfterAttach(msg: Message): void;
    protected render(): React.ReactNode;
    private injectStyles;
}
//# sourceMappingURL=fbd-editor-widget.d.ts.map