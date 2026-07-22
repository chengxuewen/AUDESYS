"use strict";
/**
 * LD GModel State Manager — undo/redo stack and dirty tracking for the
 * ladder diagram GModel.
 *
 * Each operation snapshots the current `LdGraph` before applying changes.
 * The undo stack supports up to `MAX_UNDO` (50) operations.
 *
 * Ponytail: global array + pointer, stdlib-only. No Immutable.js bloat.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LdGModelState = void 0;
const model_1 = require("../gmodel/model");
const serialization_1 = require("../gmodel/serialization");
/** Maximum undo stack depth. */
const MAX_UNDO = 50;
/**
 * GModel state wrapper with undo/redo and dirty tracking.
 *
 * Every mutation goes through `applyOperation()` which snapshots the
 * pre-mutation graph. Undo restores the previous snapshot; redo
 * re-applies the undone step.
 */
class LdGModelState {
    constructor(initial) {
        this.snapshots = [];
        this.pointer = -1;
        this._dirty = false;
        const graph = initial ?? (0, model_1.createLdGraph)();
        this.pushSnapshot(graph);
    }
    /** Return the current `LdGraph`. */
    get graph() {
        if (this.pointer < 0) {
            return (0, model_1.createLdGraph)();
        }
        return (0, serialization_1.fromJSON)(this.snapshots[this.pointer]);
    }
    /** Whether the model has unsaved changes since last save/compile. */
    get dirty() {
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
    applyOperation(mutate) {
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
    undo() {
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
    redo() {
        if (this.pointer >= this.snapshots.length - 1) {
            return null;
        }
        this.pointer++;
        this._dirty = true;
        return this.graph;
    }
    /** Mark the model as clean (e.g., after successful compilation). */
    markClean() {
        this._dirty = false;
    }
    /** Number of undo operations available. */
    get undoDepth() {
        return this.pointer;
    }
    /** Number of redo operations available. */
    get redoDepth() {
        return this.snapshots.length - 1 - this.pointer;
    }
    // ── private ───────────────────────────────────────────────
    pushSnapshot(graph) {
        this.snapshots.push((0, serialization_1.toJSON)(graph));
        if (this.snapshots.length > MAX_UNDO) {
            this.snapshots.shift();
        }
        else {
            this.pointer++;
        }
    }
}
exports.LdGModelState = LdGModelState;
//# sourceMappingURL=ld-gmodel-state.js.map