/**
 * FBD Palette Widget — React-based tool palette for the Function Block Diagram editor.
 *
 * Renders a vertical palette of selectable FBD elements organized into
 * two sections: "Logic Gates" and "Comparison & Other".
 *
 * Each tool item displays an icon and label. Clicking an item
 * selects the tool in the shared FbdToolState.
 */
import React from '@theia/core/shared/react';
import { Message } from '@lumino/messaging';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { FbdToolState } from './fbd-tool-state';
/**
 * Theia ReactWidget that renders the FBD tool palette.
 *
 * This widget is intended to be placed in the left panel of the application
 * shell when the FBD editor is active.
 */
export declare class FbdPaletteWidget extends ReactWidget {
    static readonly ID = "audesys-fbd-palette";
    static readonly LABEL = "FBD Tool Palette";
    private toolState;
    constructor(toolState: FbdToolState);
    protected onAfterAttach(msg: Message): void;
    protected render(): React.ReactNode;
    /** Inject palette CSS into the document head (once). */
    private injectStyles;
}
//# sourceMappingURL=fbd-palette-widget.d.ts.map