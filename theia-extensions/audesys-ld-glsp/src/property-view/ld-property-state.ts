/**
 * LD Property State — tracks the currently selected element and exposes
 * its properties for the property view widget.
 *
 * Uses Theia's Emitter for event-driven state broadcasting so multiple
 * consumers (property widget, operation handler) can react to selection
 * and property changes without direct coupling.
 */

import { Emitter, Event } from '@theia/core/lib/common/event';

// ============================================================================
// Selected Element Types
// ============================================================================

/** Discriminated union of all selectable element types with their properties. */
export type SelectedElement =
  | {
      id: string;
      elementType: 'contact';
      variableName: string;
      contactType: 'NO' | 'NC';
      position: { x: number; y: number };
    }
  | {
      id: string;
      elementType: 'coil';
      variableName: string;
      coilType: 'Normal' | 'Negated' | 'Set' | 'Reset';
      position: { x: number; y: number };
    }
  | {
      id: string;
      elementType: 'fb';
      fbType: string;
      position: { x: number; y: number };
    }
  | {
      id: string;
      elementType: 'rung';
      rungNumber: number;
      comment: string;
    }
  | {
      id: string;
      elementType: 'wire';
      sourceId: string;
      targetId: string;
      position: { x: number; y: number } | null;
    }
  | {
      id: string;
      elementType: 'powerrail';
      side: 'Left' | 'Right';
      position: { x: number; y: number };
    };

// ============================================================================
// Property Change Event
// ============================================================================

/** Emitted when a property is edited in the property view. */
export interface PropertyChangeEvent {
  elementId: string;
  property: string;
  value: unknown;
}

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
export class LdPropertyState {
  private selected: SelectedElement | null = null;

  private readonly onDidChangeSelectionEmitter = new Emitter<SelectedElement | null>();
  readonly onDidChangeSelection: Event<SelectedElement | null> =
    this.onDidChangeSelectionEmitter.event;

  private readonly onDidChangePropertyEmitter = new Emitter<PropertyChangeEvent>();
  readonly onDidChangeProperty: Event<PropertyChangeEvent> =
    this.onDidChangePropertyEmitter.event;

  /**
   * Select an element. Fires `onDidChangeSelection` with the element data.
   * If the same element is selected again, no event fires.
   */
  selectElement(element: SelectedElement): void {
    if (this.selected?.id === element.id) {
      return; // ponytail: no-op on re-select, prevents spurious re-renders
    }
    this.selected = element;
    this.onDidChangeSelectionEmitter.fire(element);
  }

  /** Deselect the current element. Fires `onDidChangeSelection` with null. */
  clearSelection(): void {
    if (this.selected === null) {
      return;
    }
    this.selected = null;
    this.onDidChangeSelectionEmitter.fire(null);
  }

  /** Get the currently selected element, or null if none. */
  getSelected(): SelectedElement | null {
    return this.selected;
  }

  /** Whether an element is currently selected. */
  hasSelection(): boolean {
    return this.selected !== null;
  }

  /**
   * Notify listeners that a property has changed.
   * Does NOT mutate the stored element — the caller is responsible
   * for applying the change back to the graph model.
   */
  updateProperty(elementId: string, property: string, value: unknown): void {
    this.onDidChangePropertyEmitter.fire({ elementId, property, value });
  }
}
