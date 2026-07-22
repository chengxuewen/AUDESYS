/**
 * LD Palette Widget — React-based tool palette for the Ladder Diagram editor.
 *
 * Renders a vertical palette of selectable LD elements organized into
 * two sections: "Contacts & Coils" and "Structure".
 *
 * Each tool item displays an ASCII icon and label. Clicking an item
 * selects the tool in the shared LdToolState.
 */
import React from '@theia/core/shared/react';
import { Message } from '@lumino/messaging';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { LdToolState } from './ld-tool-state';
/**
 * Theia ReactWidget that renders the LD tool palette.
 *
 * This widget is intended to be placed in the left panel of the application
 * shell when the LD editor is active.
 */
export declare class LdPaletteWidget extends ReactWidget {
    static readonly ID = "audesys-ld-palette";
    static readonly LABEL = "LD Tool Palette";
    private toolState;
    constructor(toolState: LdToolState);
    protected onAfterAttach(msg: Message): void;
    protected render(): React.ReactNode;
    /** Inject palette CSS into the document head (once). */
    private injectStyles;
}
//# sourceMappingURL=ld-palette-widget.d.ts.map