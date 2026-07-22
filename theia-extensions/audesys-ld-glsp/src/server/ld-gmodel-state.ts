/**
 * LD GModel State Manager — undo/redo stack and dirty tracking for the
 * ladder diagram GModel.
 *
 * Each operation snapshots the current `LdGraph` before applying changes.
 * The undo stack supports up to `MAX_UNDO` (50) operations.
 *
 * Ponytail: global array + pointer, stdlib-only. No Immutable.js bloat.
 */

import { LdGraph, createLdGraph } from '../gmodel/model';
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
export class LdGModelState {
  private snapshots: string[] = [];
  private pointer: number = -1;
  private _dirty: boolean = false;

  constructor(initial?: LdGraph) {
    const graph = initial ?? createLdGraph();
    this.pushSnapshot(graph);
  }

  /** Return the current `LdGraph`. */
  get graph(): LdGraph {
    if (this.pointer < 0) {
      return createLdGraph();
    }
    return fromJSON(this.snapshots[this.pointer]);
  }

  /** Whether the model has unsaved changes since last save/compile. */
  get dirty(): boolean {
    return this._dirty;
  }

  /**
   * Apply a mutation function to the graph.
   *
   * Snapshots the current state before mutation, then replaces the
   * graph with the mutation's result. Any redo history beyond the
   * current pointer is discarded.
   *
   * @returns The mutated `LdGraph` (same as `this.graph` after call).
   */
  applyOperation(mutate: (graph: LdGraph) => LdGraph): LdGraph {
    const next = mutate(this.graph);

    // Discard redo history beyond current pointer
    this.snapshots = this.snapshots.slice(0, this.pointer + 1);
    this.pushSnapshot(next);
    this._dirty = true;

    return next;
  }

  /**
   * Undo the last operation. Returns the previous graph snapshot,
   * or `null` if nothing to undo.
   */
  undo(): LdGraph | null {
    if (this.pointer <= 0) {
      return null;
    }
    this.pointer--;
    this._dirty = true;
    return this.graph;
  }

  /**
   * Redo a previously undone operation. Returns the next graph snapshot,
   * or `null` if nothing to redo.
   */
  redo(): LdGraph | null {
    if (this.pointer >= this.snapshots.length - 1) {
      return null;
    }
    this.pointer++;
    this._dirty = true;
    return this.graph;
  }

  /** Mark the model as clean (e.g., after successful compilation). */
  markClean(): void {
    this._dirty = false;
  }

  /** Number of undo operations available. */
  get undoDepth(): number {
    return this.pointer;
  }

  /** Number of redo operations available. */
  get redoDepth(): number {
    return this.snapshots.length - 1 - this.pointer;
  }

  // ── private ───────────────────────────────────────────────

  private pushSnapshot(graph: LdGraph): void {
    this.snapshots.push(toJSON(graph));
    if (this.snapshots.length > MAX_UNDO) {
      this.snapshots.shift();
    } else {
      this.pointer++;
    }
  }
}
