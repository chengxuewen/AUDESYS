"use strict";
/**
 * FBD Tool State — tracks the currently selected tool type in the palette.
 *
 * Uses Theia's Emitter for event-driven state broadcasting so multiple
 * consumers (palette widget, status bar, canvas) can react to tool changes
 * without direct coupling.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FbdToolState = void 0;
const event_1 = require("@theia/core/lib/common/event");
// ============================================================================
// ToolState
// ============================================================================
/**
 * Centralised tool selection state for the FBD editor palette.
 *
 * Only one tool can be selected at a time. Consumers listen to
 * `onDidChangeTool` to react to selection changes.
 */
class FbdToolState {
    constructor() {
        this.currentTool = null;
        this.onDidChangeToolEmitter = new event_1.Emitter();
        this.onDidChangeTool = this.onDidChangeToolEmitter.event;
    }
    /**
     * Select a tool. Deselects any previously selected tool first.
     * Fires `onDidChangeTool` event.
     */
    selectTool(type) {
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
    deselectTool() {
        if (this.currentTool === null) {
            return;
        }
        this.currentTool = null;
        this.onDidChangeToolEmitter.fire(null);
    }
    /** Get the currently selected tool, or null if none. */
    getSelectedTool() {
        return this.currentTool;
    }
    /** Whether any tool is currently selected. */
    hasSelection() {
        return this.currentTool !== null;
    }
}
exports.FbdToolState = FbdToolState;
//# sourceMappingURL=fbd-tool-state.js.map