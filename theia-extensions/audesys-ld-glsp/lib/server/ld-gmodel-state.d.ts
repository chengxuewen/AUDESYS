/**
 * LD GModel State Manager — undo/redo stack and dirty tracking for the
 * ladder diagram GModel.
 *
 * Each operation snapshots the current `LdGraph` before applying changes.
 * The undo stack supports up to `MAX_UNDO` (50) operations.
 *
 * Ponytail: global array + pointer, stdlib-only. No Immutable.js bloat.
 */
import { LdGraph } from '../gmodel/model';
/**
 * GModel state wrapper with undo/redo and dirty tracking.
 *
 * Every mutation goes through `applyOperation()` which snapshots the
 * pre-mutation graph. Undo restores the previous snapshot; redo
 * re-applies the undone step.
 */
export declare class LdGModelState {
    private snapshots;
    private pointer;
    private _dirty;
    constructor(initial?: LdGraph);
    /** Return the current `LdGraph`. */
    get graph(): LdGraph;
    /** Whether the model has unsaved changes since last save/compile. */
    get dirty(): boolean;
    /**
     * Apply a mutation function to the graph.
     *
     * Snapshots the current state before mutation, then replaces the
     * graph with the mutation's result. Any redo history beyond the
     * current pointer is discarded.
     *
     * @returns The mutated `LdGraph` (same as `this.graph` after call).
     */
    applyOperation(mutate: (graph: LdGraph) => LdGraph): LdGraph;
    /**
     * Undo the last operation. Returns the previous graph snapshot,
     * or `null` if nothing to undo.
     */
    undo(): LdGraph | null;
    /**
     * Redo a previously undone operation. Returns the next graph snapshot,
     * or `null` if nothing to redo.
     */
    redo(): LdGraph | null;
    /** Mark the model as clean (e.g., after successful compilation). */
    markClean(): void;
    /** Number of undo operations available. */
    get undoDepth(): number;
    /** Number of redo operations available. */
    get redoDepth(): number;
    private pushSnapshot;
}
//# sourceMappingURL=ld-gmodel-state.d.ts.map