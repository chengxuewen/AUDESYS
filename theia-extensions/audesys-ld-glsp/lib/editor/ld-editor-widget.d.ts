/**
 * LD Editor Widget — SVG-based ladder diagram renderer.
 *
 * Renders the LdGraph model as an interactive SVG canvas. Supports:
 * - Power rails (left/right vertical lines)
 * - Rungs with contacts, coils, and FB placeholders
 * - Wires between elements
 * - Click-to-select with visual feedback
 * - Tool-mode click to create new elements
 * - Right-click context menu
 *
 * Ponytail: plain SVG + React state. No GLSP rendering server, no canvas libs.
 */
import React from 'react';
import { Message } from '@lumino/messaging';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { LdToolState } from '../tool-palette/ld-tool-state';
import { LdGModelState } from '../server/ld-gmodel-state';
import { LdOperationHandler } from '../server/ld-operation-handler';
export interface LdEditorSelection {
    elementId: string;
    elementType: string;
    rungId?: string;
}
export declare class LdEditorWidget extends ReactWidget {
    static readonly ID = "audesys-ld-editor";
    static readonly LABEL = "Ladder Diagram";
    private readonly toolState;
    private readonly modelState;
    private readonly handler;
    private onSelectionChange?;
    private _dirty;
    constructor(toolState: LdToolState, modelState: LdGModelState, handler: LdOperationHandler);
    get dirty(): boolean;
    setSelectionCallback(fn: (sel: LdEditorSelection | null) => void): void;
    protected onAfterAttach(msg: Message): void;
    protected render(): React.ReactNode;
    private injectStyles;
    private injectCssContent;
}
//# sourceMappingURL=ld-editor-widget.d.ts.map