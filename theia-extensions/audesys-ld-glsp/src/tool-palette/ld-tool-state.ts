/**
 * LD Tool State — tracks the currently selected tool type in the palette.
 *
 * Uses Theia's Emitter for event-driven state broadcasting so multiple
 * consumers (palette widget, status bar, canvas) can react to tool changes
 * without direct coupling.
 */

import { Emitter, Event } from '@theia/core/lib/common/event';

// ============================================================================
// Tool Type Definition
// ============================================================================

/** All tool types available in the LD palette. */
export type LdToolType =
    | 'no-contact'
    | 'nc-contact'
    | 'coil'
    | 'negated-coil'
    | 'set-coil'
    | 'reset-coil'
    | 'horizontal-wire'
    | 'vertical-wire'
    | 'power-rail-left'
    | 'power-rail-right'
    | 'fb-placeholder'
    | 'rung';

// ============================================================================
// ToolState
// ============================================================================

/**
 * Centralised tool selection state for the LD editor palette.
 *
 * Only one tool can be selected at a time. Consumers listen to
 * `onDidChangeTool` to react to selection changes.
 */
export class LdToolState {
    private currentTool: LdToolType | null = null;

    private readonly onDidChangeToolEmitter = new Emitter<LdToolType | null>();
    readonly onDidChangeTool: Event<LdToolType | null> = this.onDidChangeToolEmitter.event;

    /**
     * Select a tool. Deselects any previously selected tool first.
     * Fires `onDidChangeTool` event.
     */
    selectTool(type: LdToolType): void {
        console.debug('[LdToolState] selectTool:', type, 'current:', this.currentTool);
        if (this.currentTool === type) {
            console.debug('[LdToolState] no-op: same tool already selected');
            return; // ponytail: no-op on re-select, prevents spurious events
        }
        this.currentTool = type;
        this.onDidChangeToolEmitter.fire(type);

    /**
     * Deselect the current tool (cursor mode).
     * Fires `onDidChangeTool` with null.
     */
    deselectTool(): void {
        console.debug('[LdToolState] deselectTool, current:', this.currentTool);
        if (this.currentTool === null) {
            return;
        }
        this.currentTool = null;
        this.onDidChangeToolEmitter.fire(null);
    }

    /** Get the currently selected tool, or null if none. */
    getSelectedTool(): LdToolType | null {
        return this.currentTool;
    }

    /** Whether any tool is currently selected. */
    hasSelection(): boolean {
        return this.currentTool !== null;
    }
}
