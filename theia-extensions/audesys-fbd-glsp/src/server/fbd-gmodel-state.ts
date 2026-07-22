/**
 * FBD GModel State Manager — undo/redo stack and dirty tracking for the
 * function block diagram GModel.
 *
 * Each operation snapshots the current `FbdGraph` before applying changes.
 * The undo stack supports up to `MAX_UNDO` (50) operations.
 *
 * Ponytail: clone of LD GModelState pattern — global array + pointer,
 * stdlib-only. No Immutable.js bloat.
 */

import { FbdGraph, createFbdGraph } from '../gmodel/model';
import { toJSON, fromJSON } from '../gmodel/serialization';

/** Maximum undo stack depth. */
const MAX_UNDO = 50;

/**
 * GModel state wrapper with undo/redo and dirty tracking.
 *
 * Every mutation goes through `applyOperation()` which snapshots the
 * pre-mutation graph. Undo restores the previous snapshot; redo
 * re-applies the undone step.
 */
export class FbdGModelState {
  private snapshots: string[] = [];
  private pointer: number = -1;
  private _dirty: boolean = false;

  constructor(initial?: FbdGraph) {
    const graph = initial ?? createFbdGraph();
    this.pushSnapshot(graph);
  }

  /** Return the current `FbdGraph`. */
  get graph(): FbdGraph {
    if (this.pointer < 0 || this.pointer >= this.snapshots.length) {
      return createFbdGraph();
    }
    return fromJSON(this.snapshots[this.pointer]);
  }

  /** Whether the model has unsaved changes since last save/compile. */
  get dirty(): boolean {
    return this._dirty;
  }

  /** Mark the model as clean (saved/compiled). */
  markClean(): void {
    this._dirty = false;
  }

  /**
   * Apply a mutation function to the graph.
   *
   * Snapshots the current state before mutation, then replaces the
   * graph with the mutation's result. Any redo history beyond the
   * current pointer is discarded.
   *
   * @returns The mutated `FbdGraph` (same as `this.graph` after call).
   */
  applyOperation(mutate: (graph: FbdGraph) => FbdGraph): FbdGraph {
    const next = mutate(this.graph);
    this.pushSnapshot(next);
    return next;
  }

  /** Whether undo is available (pointer > 0). */
  get canUndo(): boolean {
    return this.pointer > 0;
  }

  /** Whether redo is available (pointer < last snapshot). */
  get canRedo(): boolean {
    return this.pointer < this.snapshots.length - 1;
  }

  /**
   * Undo the last operation.
   * @returns The restored `FbdGraph`, or null if nothing to undo.
   */
  undo(): FbdGraph | null {
    if (!this.canUndo) {
      return null;
    }
    this.pointer -= 1;
    this._dirty = true;
    return this.graph;
  }

  /**
   * Redo a previously undone operation.
   * @returns The restored `FbdGraph`, or null if nothing to redo.
   */
  redo(): FbdGraph | null {
    if (!this.canRedo) {
      return null;
    }
    this.pointer += 1;
    this._dirty = true;
    return this.graph;
  }

  // ── Internal ──────────────────────────────────────────────

  private pushSnapshot(graph: FbdGraph): void {
    // Discard any redo history beyond current pointer
    this.snapshots = this.snapshots.slice(0, this.pointer + 1);

    // Enforce max undo depth
    if (this.snapshots.length >= MAX_UNDO) {
      this.snapshots.shift();
    }

    this.snapshots.push(toJSON(graph));
    this.pointer = this.snapshots.length - 1;
    this._dirty = true;
  }
}
