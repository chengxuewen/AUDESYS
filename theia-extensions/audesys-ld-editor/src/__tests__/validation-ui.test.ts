/**
 * parseValidationErrors unit tests — pure function mapping a
 * ValidationResult onto the elements to mark in the view.
 */
import { describe, it, expect } from 'vitest';

import { parseValidationErrors } from '../model/validation-ui';
import { createLdGraph, createRung, createContact, createCoil, LdGraph } from '../model/model';
import { ContactType, CoilType } from '../model/nodes';

/** Graph with one rung containing one NO contact. */
function graphWithRung(): LdGraph {
    const contact = createContact(ContactType.NO, 'IN0', { x: 40, y: 40 });
    const rung = createRung(1, [contact.id], 'Main');
    return { ...createLdGraph(), rungs: [rung], nodes: [contact] };
}

describe('parseValidationErrors', () => {
    it('maps "Rung N: ..." messages to rung numbers', () => {
        // Arrange
        const graph = graphWithRung();
        const result = { valid: false, errors: ['Rung 1: has a coil but no contacts'] };

        // Act
        const markup = parseValidationErrors(result, graph);

        // Assert
        expect(markup.total).toBe(1);
        expect(markup.rungNumbers).toEqual([1]);
        expect(markup.rungErrors.get(1)).toEqual(['Rung 1: has a coil but no contacts']);
        expect(markup.nodeIds).toEqual([]);
    });

    it('sorts multiple rung errors ascending', () => {
        // Arrange
        const graph = graphWithRung();
        const result = {
            valid: false,
            errors: [
                'Rung 2: multiple coils (2) — only one allowed',
                'Rung 1: has a coil but no contacts',
                'Rung 1: coil must be to the right of all contacts',
            ],
        };

        // Act
        const markup = parseValidationErrors(result, graph);

        // Assert
        expect(markup.rungNumbers).toEqual([1, 2]);
        expect(markup.rungErrors.get(1)?.length).toBe(2);
        expect(markup.rungErrors.get(2)?.length).toBe(1);
    });

    it('maps empty-rung warnings to rung number (yellow, non-blocking)', () => {
        // Arrange
        const graph = graphWithRung();
        const rungId = graph.rungs[0].id;
        const result = {
            valid: true,
            errors: [],
            warnings: [`Empty rung: "${rungId}" (rung 1) has no elements`],
        };

        // Act
        const markup = parseValidationErrors(result, graph);

        // Assert: surfaces in the warning channel, NOT as a red error
        expect(markup.rungNumbers).toEqual([]);
        expect(markup.rungIds).toEqual([]);
        expect(markup.warningRungNumbers).toEqual([1]);
        expect(markup.warningTotal).toBe(1);
        expect(markup.rungWarnings.get(1)).toHaveLength(1);
    });

    it('maps orphan-node messages to the existing node id', () => {
        // Arrange
        const graph = graphWithRung();
        const contactId = graph.nodes[0].id;
        const result = {
            valid: false,
            errors: [`Orphan node: "${contactId}" (type: node:contact) is not referenced by any rung`],
        };

        // Act
        const markup = parseValidationErrors(result, graph);

        // Assert
        expect(markup.nodeIds).toEqual([contactId]);
        expect(markup.nodeErrors.get(contactId)).toEqual([
            `Orphan node: "${contactId}" (type: node:contact) is not referenced by any rung`,
        ]);
        expect(markup.rungNumbers).toEqual([]);
    });

    it('ignores quoted ids that do not exist in the graph (dangling refs)', () => {
        // Arrange
        const graph = graphWithRung();
        const result = {
            valid: false,
            errors: [
                'Dangling edge source: "e1" references non-existent source node "missing-node"',
                'Branch "b1": anchor "missing-anchor" does not exist',
            ],
        };

        // Act
        const markup = parseValidationErrors(result, graph);

        // Assert
        expect(markup.total).toBe(2);
        expect(markup.rungNumbers).toEqual([]);
        expect(markup.nodeIds).toEqual([]);
    });

    it('returns empty markup for a valid result', () => {
        // Arrange
        const graph = graphWithRung();
        const result = { valid: true, errors: [] as string[] };

        // Act
        const markup = parseValidationErrors(result, graph);

        // Assert
        expect(markup.total).toBe(0);
        expect(markup.rungNumbers).toEqual([]);
        expect(markup.nodeIds).toEqual([]);
        expect(markup.messages).toEqual([]);
    });

    it('keeps both rung and node mappings when both error kinds are present', () => {
        // Arrange
        const contact = createContact(ContactType.NO, 'IN0', { x: 40, y: 40 });
        const coil = createCoil(CoilType.Normal, 'OUT0', { x: 200, y: 40 });
        const rung = createRung(1, [contact.id, coil.id], 'Main');
        const graph: LdGraph = { ...createLdGraph(), rungs: [rung], nodes: [contact, coil] };
        const result = {
            valid: false,
            errors: [
                'Rung 1: coil must be to the right of all contacts',
                `Orphan node: "${coil.id}" (type: node:coil) is not referenced by any rung`,
            ],
        };

        // Act
        const markup = parseValidationErrors(result, graph);

        // Assert
        expect(markup.total).toBe(2);
        expect(markup.rungNumbers).toEqual([1]);
        expect(markup.nodeIds).toEqual([coil.id]);
    });
});
