"use strict";
/**
 * LD Property State — tracks the currently selected element and exposes
 * its properties for the property view widget.
 *
 * Uses Theia's Emitter for event-driven state broadcasting so multiple
 * consumers (property widget, operation handler) can react to selection
 * and property changes without direct coupling.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LdPropertyState = void 0;
const event_1 = require("@theia/core/lib/common/event");
// ============================================================================
// LdPropertyState
// ============================================================================
/**
 * Centralised element selection state for the LD editor property view.
 *
 * Only one element can be selected at a time. Consumers listen to
 * `onDidChangeSelection` to update the property form, and to
 * `onDidChangeProperty` to react to user edits.
 */
class LdPropertyState {
    constructor() {
        this.selected = null;
        this.onDidChangeSelectionEmitter = new event_1.Emitter();
        this.onDidChangeSelection = this.onDidChangeSelectionEmitter.event;
        this.onDidChangePropertyEmitter = new event_1.Emitter();
        this.onDidChangeProperty = this.onDidChangePropertyEmitter.event;
    }
    /**
     * Select an element. Fires `onDidChangeSelection` with the element data.
     * If the same element is selected again, no event fires.
     */
    selectElement(element) {
        if (this.selected?.id === element.id) {
            return; // ponytail: no-op on re-select, prevents spurious re-renders
        }
        this.selected = element;
        this.onDidChangeSelectionEmitter.fire(element);
    }
    /** Deselect the current element. Fires `onDidChangeSelection` with null. */
    clearSelection() {
        if (this.selected === null) {
            return;
        }
        this.selected = null;
        this.onDidChangeSelectionEmitter.fire(null);
    }
    /** Get the currently selected element, or null if none. */
    getSelected() {
        return this.selected;
    }
    /** Whether an element is currently selected. */
    hasSelection() {
        return this.selected !== null;
    }
    /**
     * Notify listeners that a property has changed.
     * Does NOT mutate the stored element — the caller is responsible
     * for applying the change back to the graph model.
     */
    updateProperty(elementId, property, value) {
        this.onDidChangePropertyEmitter.fire({ elementId, property, value });
    }
}
exports.LdPropertyState = LdPropertyState;
//# sourceMappingURL=ld-property-state.js.map