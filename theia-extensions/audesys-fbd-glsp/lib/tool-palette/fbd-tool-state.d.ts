/**
 * FBD Tool State — tracks the currently selected tool type in the palette.
 *
 * Uses Theia's Emitter for event-driven state broadcasting so multiple
 * consumers (palette widget, status bar, canvas) can react to tool changes
 * without direct coupling.
 */
import { Event } from '@theia/core/lib/common/event';
/** All tool types available in the FBD palette. */
export type FbdToolType = 'and-gate' | 'or-gate' | 'xor-gate' | 'not-gate' | 'mux-gate' | 'eq-cmp' | 'gt-cmp' | 'lt-cmp' | 'fb-instance' | 'wire';
/**
 * Centralised tool selection state for the FBD editor palette.
 *
 * Only one tool can be selected at a time. Consumers listen to
 * `onDidChangeTool` to react to selection changes.
 */
export declare class FbdToolState {
    private currentTool;
    private readonly onDidChangeToolEmitter;
    readonly onDidChangeTool: Event<FbdToolType | null>;
    /**
     * Select a tool. Deselects any previously selected tool first.
     * Fires `onDidChangeTool` event.
     */
    selectTool(type: FbdToolType): void;
    /**
     * Deselect the current tool (cursor mode).
     * Fires `onDidChangeTool` with null.
     */
    deselectTool(): void;
    /** Get the currently selected tool, or null if none. */
    getSelectedTool(): FbdToolType | null;
    /** Whether any tool is currently selected. */
    hasSelection(): boolean;
}
//# sourceMappingURL=fbd-tool-state.d.ts.map