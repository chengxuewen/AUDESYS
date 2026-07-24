/**
 * LD Tool State — tracks the currently selected tool type in the palette.
 *
 * Uses Theia's Emitter for event-driven state broadcasting so multiple
 * consumers (palette widget, status bar, canvas) can react to tool changes
 * without direct coupling.
 */
import { Event } from '@theia/core/lib/common/event';
/** All tool types available in the LD palette. */
export type LdToolType = 'no-contact' | 'nc-contact' | 'coil' | 'negated-coil' | 'set-coil' | 'reset-coil' | 'horizontal-wire' | 'vertical-wire' | 'power-rail-left' | 'power-rail-right' | 'fb-placeholder' | 'rung';
/**
 * Centralised tool selection state for the LD editor palette.
 *
 * Only one tool can be selected at a time. Consumers listen to
 * `onDidChangeTool` to react to selection changes.
 */
export declare class LdToolState {
    private currentTool;
    private readonly onDidChangeToolEmitter;
    readonly onDidChangeTool: Event<LdToolType | null>;
    /**
     * Select a tool. Deselects any previously selected tool first.
     * Fires `onDidChangeTool` event.
     */
    selectTool(type: LdToolType): void;
    /** Get the currently selected tool, or null if none. */
    getSelectedTool(): LdToolType | null;
    /** Whether any tool is currently selected. */
    hasSelection(): boolean;
}
//# sourceMappingURL=ld-tool-state.d.ts.map