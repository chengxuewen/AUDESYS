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
import { FbdGraph } from '../gmodel/model';
/**
 * GModel state wrapper with undo/redo and dirty tracking.
 *
 * Every mutation goes through `applyOperation()` which snapshots the
 * pre-mutation graph. Undo restores the previous snapshot; redo
 * re-applies the undone step.
 */
export declare class FbdGModelState {
    private snapshots;
    private pointer;
    private _dirty;
    constructor(initial?: FbdGraph);
    /** Return the current `FbdGraph`. */
    get graph(): FbdGraph;
    /** Whether the model has unsaved changes since last save/compile. */
    get dirty(): boolean;
    /** Mark the model as clean (saved/compiled). */
    markClean(): void;
    /**
     * Apply a mutation function to the graph.
     *
     * Snapshots the current state before mutation, then replaces the
     * graph with the mutation's result. Any redo history beyond the
     * current pointer is discarded.
     *
     * @returns The mutated `FbdGraph` (same as `this.graph` after call).
     */
    applyOperation(mutate: (graph: FbdGraph) => FbdGraph): FbdGraph;
    /** Whether undo is available (pointer > 0). */
    get canUndo(): boolean;
    /** Whether redo is available (pointer < last snapshot). */
    get canRedo(): boolean;
    /**
     * Undo the last operation.
     * @returns The restored `FbdGraph`, or null if nothing to undo.
     */
    undo(): FbdGraph | null;
    /**
     * Redo a previously undone operation.
     * @returns The restored `FbdGraph`, or null if nothing to redo.
     */
    redo(): FbdGraph | null;
    private pushSnapshot;
}
//# sourceMappingURL=fbd-gmodel-state.d.ts.map