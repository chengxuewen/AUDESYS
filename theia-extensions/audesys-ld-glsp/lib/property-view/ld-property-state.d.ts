/**
 * LD Property State — tracks the currently selected element and exposes
 * its properties for the property view widget.
 *
 * Uses Theia's Emitter for event-driven state broadcasting so multiple
 * consumers (property widget, operation handler) can react to selection
 * and property changes without direct coupling.
 */
import { Event } from '@theia/core/lib/common/event';
/** Discriminated union of all selectable element types with their properties. */
export type SelectedElement = {
    id: string;
    elementType: 'contact';
    variableName: string;
    contactType: 'NO' | 'NC';
    position: {
        x: number;
        y: number;
    };
} | {
    id: string;
    elementType: 'coil';
    variableName: string;
    coilType: 'Normal' | 'Negated' | 'Set' | 'Reset';
    position: {
        x: number;
        y: number;
    };
} | {
    id: string;
    elementType: 'fb';
    fbType: string;
    position: {
        x: number;
        y: number;
    };
} | {
    id: string;
    elementType: 'rung';
    rungNumber: number;
    comment: string;
} | {
    id: string;
    elementType: 'wire';
    sourceId: string;
    targetId: string;
    position: {
        x: number;
        y: number;
    } | null;
} | {
    id: string;
    elementType: 'powerrail';
    side: 'Left' | 'Right';
    position: {
        x: number;
        y: number;
    };
};
/** Emitted when a property is edited in the property view. */
export interface PropertyChangeEvent {
    elementId: string;
    property: string;
    value: unknown;
}
/**
 * Centralised element selection state for the LD editor property view.
 *
 * Only one element can be selected at a time. Consumers listen to
 * `onDidChangeSelection` to update the property form, and to
 * `onDidChangeProperty` to react to user edits.
 */
export declare class LdPropertyState {
    private selected;
    private readonly onDidChangeSelectionEmitter;
    readonly onDidChangeSelection: Event<SelectedElement | null>;
    private readonly onDidChangePropertyEmitter;
    readonly onDidChangeProperty: Event<PropertyChangeEvent>;
    /**
     * Select an element. Fires `onDidChangeSelection` with the element data.
     * If the same element is selected again, no event fires.
     */
    selectElement(element: SelectedElement): void;
    /** Deselect the current element. Fires `onDidChangeSelection` with null. */
    clearSelection(): void;
    /** Get the currently selected element, or null if none. */
    getSelected(): SelectedElement | null;
    /** Whether an element is currently selected. */
    hasSelection(): boolean;
    /**
     * Notify listeners that a property has changed.
     * Does NOT mutate the stored element — the caller is responsible
     * for applying the change back to the graph model.
     */
    updateProperty(elementId: string, property: string, value: unknown): void;
}
//# sourceMappingURL=ld-property-state.d.ts.map