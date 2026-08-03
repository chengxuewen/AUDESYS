/**
 * LdGModelState unit tests — undo/redo stack, dirty tracking, MAX_UNDO cap.
 */
import { describe, it, expect } from 'vitest';

import { LdGModelState } from '../state/ld-gmodel-state';
import { LdGraph, createContact } from '../model/model';
import { ContactType } from '../model/nodes';

/** Mutation that appends one contact to the graph. */
function addOneContact(g: LdGraph): LdGraph {
    const contact = createContact(ContactType.NO, `X${g.nodes.length}`);
    return { ...g, nodes: [...g.nodes, contact] };
}

describe('applyOperation', () => {
    it('updates the graph and makes the state dirty', () => {
        // Arrange
        const state = new LdGModelState();
        expect(state.dirty).toBe(false);

        // Act
        const next = state.applyOperation(addOneContact);

        // Assert
        expect(next.nodes.length).toBe(1);
        expect(state.graph.nodes.length).toBe(1);
        expect(state.dirty).toBe(true);
    });

    it('pushes an undo snapshot for the pre-mutation graph', () => {
        // Arrange
        const state = new LdGModelState();
        expect(state.undoDepth).toBe(0);

        // Act
        state.applyOperation(addOneContact);

        // Assert
        expect(state.undoDepth).toBe(1);
    });
});

describe('undo', () => {
    it('restores the previous graph', () => {
        // Arrange
        const state = new LdGModelState();
        state.applyOperation(addOneContact);
        state.applyOperation(addOneContact);
        expect(state.graph.nodes.length).toBe(2);

        // Act
        const previous = state.undo();

        // Assert
        expect(previous).not.toBeNull();
        expect(previous?.nodes.length).toBe(1);
        expect(state.graph.nodes.length).toBe(1);
    });

    it('returns null when there is nothing to undo', () => {
        // Arrange
        const state = new LdGModelState();

        // Act / Assert — only the initial snapshot exists
        expect(state.undo()).toBeNull();
    });
});

describe('redo', () => {
    it('re-applies an undone operation', () => {
        // Arrange
        const state = new LdGModelState();
        state.applyOperation(addOneContact);
        state.undo();
        expect(state.graph.nodes.length).toBe(0);

        // Act
        const redone = state.redo();

        // Assert
        expect(redone).not.toBeNull();
        expect(redone?.nodes.length).toBe(1);
        expect(state.graph.nodes.length).toBe(1);
    });

    it('returns null when there is nothing to redo', () => {
        // Arrange
        const state = new LdGModelState();
        state.applyOperation(addOneContact);

        // Act / Assert — at the head of history
        expect(state.redo()).toBeNull();
    });

    it('discards redo history when a new operation follows an undo', () => {
        // Arrange
        const state = new LdGModelState();
        state.applyOperation(addOneContact);
        state.applyOperation(addOneContact);
        state.undo(); // pointer at 1-node snapshot, one redo available
        expect(state.redoDepth).toBe(1);

        // Act — branch the history
        state.applyOperation(addOneContact);

        // Assert — redo history beyond the pointer is gone
        expect(state.redoDepth).toBe(0);
        expect(state.redo()).toBeNull();
    });
});

describe('dirty tracking', () => {
    it('is true after an operation, false after markClean', () => {
        // Arrange
        const state = new LdGModelState();

        // Act / Assert
        state.applyOperation(addOneContact);
        expect(state.dirty).toBe(true);

        state.markClean();
        expect(state.dirty).toBe(false);
    });

    it('becomes dirty again after undo/redo', () => {
        // Arrange
        const state = new LdGModelState();
        state.applyOperation(addOneContact);
        state.markClean();

        // Act / Assert
        state.undo();
        expect(state.dirty).toBe(true);
        state.markClean();
        state.redo();
        expect(state.dirty).toBe(true);
    });
});

describe('MAX_UNDO limit', () => {
    it('caps the undo stack at 50 snapshots (oldest dropped)', () => {
        // Arrange
        const state = new LdGModelState();

        // Act — apply 60 operations (50-cap + 10 overflow)
        for (let i = 0; i < 60; i++) {
            state.applyOperation(addOneContact);
        }

        // Assert — current graph reflects all 60 mutations
        expect(state.graph.nodes.length).toBe(60);

        // Only 49 undos are possible (50 snapshots incl. the initial one).
        let undoCount = 0;
        let last: LdGraph | null = null;
        while (true) {
            const prev = state.undo();
            if (prev === null) {
                break;
            }
            last = prev;
            undoCount++;
        }

        expect(undoCount).toBe(49);
        // Oldest retained snapshot = initial graph + 11 operations
        // (60 ops + initial − 50 kept = 11 dropped, oldest kept has 11 nodes).
        expect(last?.nodes.length).toBe(11);
    });
});
