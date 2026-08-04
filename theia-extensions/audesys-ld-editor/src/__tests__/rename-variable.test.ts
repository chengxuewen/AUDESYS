/**
 * Variable rename tests — renameVariable handler (P0-4).
 * SDD: LD-RENAME (plan C2) — double-click inline rename commits via the
 * handler; validates target is a contact/coil and the name is sane.
 */
import { describe, it, expect } from 'vitest';

import { LdOperationHandler } from '../backend/ld-operation-handler';
import { createLdGraph, LdGraph } from '../model/model';
import { ContactType, CoilType } from '../model/nodes';
import { COIL_X_OFFSET } from '../model/grid';

function graphWithContact(): { handler: LdOperationHandler; graph: LdGraph; contactId: string; rungId: string } {
    const handler = new LdOperationHandler();
    const graph = handler.addRung(createLdGraph());
    const rungId = graph.rungs[0].id;
    const next = handler.addContact(graph, { position: { x: 40, y: 40 }, type: ContactType.NO, rungId });
    const contactId = next.rungs[0].elementIds[0];
    return { handler, graph: next, contactId, rungId };
}

describe('renameVariable', () => {
    it('renames a contact and trims whitespace', () => {
        // Arrange
        const { handler, graph, contactId } = graphWithContact();

        // Act
        const next = handler.renameVariable(graph, { elementId: contactId, variableName: '  motor_run  ' });

        // Assert
        const contact = next.nodes.find((n) => n.id === contactId);
        expect(contact).toMatchObject({ variableName: 'motor_run' });
    });

    it('renames a coil', () => {
        // Arrange
        const { handler, graph, contactId, rungId } = graphWithContact();
        const withCoil = handler.addCoil(graph, { position: { x: COIL_X_OFFSET, y: 40 }, type: CoilType.Normal, rungId });
        const coilId = withCoil.rungs[0].elementIds[1];

        // Act
        const next = handler.renameVariable(withCoil, { elementId: coilId, variableName: 'motor_out' });

        // Assert
        expect(next.nodes.find((n) => n.id === coilId)).toMatchObject({ variableName: 'motor_out' });
    });

    it('is idempotent when the name is unchanged', () => {
        // Arrange
        const { handler, graph, contactId } = graphWithContact();

        // Act
        const next = handler.renameVariable(graph, { elementId: contactId, variableName: 'IN0' });

        // Assert
        expect(next).toBe(graph);
    });

    it('rejects an empty name', () => {
        // Arrange
        const { handler, graph, contactId } = graphWithContact();

        // Act / Assert
        expect(() => handler.renameVariable(graph, { elementId: contactId, variableName: '   ' }))
            .toThrow(/cannot be empty/);
    });

    it('rejects names with whitespace', () => {
        // Arrange
        const { handler, graph, contactId } = graphWithContact();

        // Act / Assert
        expect(() => handler.renameVariable(graph, { elementId: contactId, variableName: 'a b' }))
            .toThrow(/whitespace/);
    });

    it('rejects non-contact/coil elements', () => {
        // Arrange — the left power rail
        const { handler, graph } = graphWithContact();
        const rail = graph.nodes.find((n) => n.type === 'node:powerrail');

        // Act / Assert
        expect(() => handler.renameVariable(graph, { elementId: rail!.id, variableName: 'X9' }))
            .toThrow(/Not a contact or coil/);
    });

    it('throws for unknown elements', () => {
        // Arrange
        const { handler, graph } = graphWithContact();

        // Act / Assert
        expect(() => handler.renameVariable(graph, { elementId: 'nope', variableName: 'X9' }))
            .toThrow(/Not a contact or coil/);
    });
});
