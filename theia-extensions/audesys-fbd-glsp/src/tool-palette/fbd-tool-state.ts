/**
 * FBD Tool State — tracks the currently selected tool type in the palette.
 *
 * Uses Theia's Emitter for event-driven state broadcasting so multiple
 * consumers (palette widget, status bar, canvas) can react to tool changes
 * without direct coupling.
 */

import { Emitter, Event } from '@theia/core/lib/common/event';

// ============================================================================
// Tool Type Definition
// ============================================================================

/** All tool types available in the FBD palette. */
export type FbdToolType =
    | 'and-gate'
    | 'or-gate'
    | 'xor-gate'
    | 'not-gate'
    | 'mux-gate'
    | 'eq-cmp'
    | 'gt-cmp'
    | 'lt-cmp'
    | 'fb-instance'
    | 'wire';

// ============================================================================
// ToolState
// ============================================================================

/**
 * Centralised tool selection state for the FBD editor palette.
 *
 * Only one tool can be selected at a time. Consumers listen to
 * `onDidChangeTool` to react to selection changes.
 */
export class FbdToolState {
    private currentTool: FbdToolType | null = null;

    private readonly onDidChangeToolEmitter = new Emitter<FbdToolType | null>();
    readonly onDidChangeTool: Event<FbdToolType | null> = this.onDidChangeToolEmitter.event;

    /**
     * Select a tool. Deselects any previously selected tool first.
     * Fires `onDidChangeTool` event.
     */
    selectTool(type: FbdToolType): void {
        if (this.currentTool === type) {
            return; // ponytail: no-op on re-select, prevents spurious events
        }
        this.currentTool = type;
        this.onDidChangeToolEmitter.fire(type);
    }

    /**
     * Deselect the current tool (cursor mode).
     * Fires `onDidChangeTool` with null.
     */
    deselectTool(): void {
        if (this.currentTool === null) {
            return;
        }
        this.currentTool = null;
        this.onDidChangeToolEmitter.fire(null);
    }

    /** Get the currently selected tool, or null if none. */
    getSelectedTool(): FbdToolType | null {
        return this.currentTool;
    }

    /** Whether any tool is currently selected. */
    hasSelection(): boolean {
        return this.currentTool !== null;
    }
}
