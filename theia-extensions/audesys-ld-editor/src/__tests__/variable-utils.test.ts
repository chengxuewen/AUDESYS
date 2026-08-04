/**
 * Variable utils tests — findVariable + listVariables (P1 find / cross-ref).
 *
 * Pure functions over LdGraph; graphs are built through the LdOperationHandler
 * so they mirror real editor state (auto-names, rung ordering).
 */
import { describe, it, expect } from 'vitest';

import { LdOperationHandler } from '../backend/ld-operation-handler';
import { createLdGraph, LdGraph } from '../model/model';
import { ContactType, CoilType } from '../model/nodes';
import { COIL_X_OFFSET } from '../model/grid';
import { findVariable, listVariables } from '../model/variable-utils';

/**
 * Two contacts (motor_run, motor_stop) + one coil (motor_run) on a single rung,
 * plus the default power rails.
 */
function graphWithVars(): LdGraph {
    const handler = new LdOperationHandler();
    let graph = handler.addRung(createLdGraph());
    const rungId = graph.rungs[0].id;
    graph = handler.addContact(graph, { position: { x: 40, y: 40 }, type: ContactType.NO, rungId });
    const contact1 = graph.rungs[0].elementIds[0];
    graph = handler.addContact(graph, { position: { x: 120, y: 40 }, type: ContactType.NC, rungId });
    const contact2 = graph.rungs[0].elementIds[1];
    graph = handler.addCoil(graph, { position: { x: COIL_X_OFFSET, y: 40 }, type: CoilType.Normal, rungId });
    const coil = graph.rungs[0].elementIds[2];
    graph = handler.renameVariable(graph, { elementId: contact1, variableName: 'motor_run' });
    graph = handler.renameVariable(graph, { elementId: contact2, variableName: 'motor_stop' });
    graph = handler.renameVariable(graph, { elementId: coil, variableName: 'motor_run' });
    return graph;
}

describe('findVariable', () => {
    it('returns all nodes whose variable name matches exactly (case-insensitive)', () => {
        // Arrange / Act
        const found = findVariable(graphWithVars(), 'MOTOR_RUN');

        // Assert
        expect(found).toHaveLength(2);
        expect(found.every((n) => n.variableName === 'motor_run')).toBe(true);
    });

    it('matches partial substrings', () => {
        // Arrange / Act
        const found = findVariable(graphWithVars(), 'motor');

        // Assert
        expect(found).toHaveLength(3);
    });

    it('returns only contact/coil nodes (rails and fbs never match)', () => {
        // Arrange / Act
        const found = findVariable(graphWithVars(), 'motor_run');

        // Assert
        expect(found.every((n) => n.type === 'node:contact' || n.type === 'node:coil')).toBe(true);
    });

    it('returns empty array for empty or whitespace-only query', () => {
        // Arrange / Act / Assert
        expect(findVariable(graphWithVars(), '')).toEqual([]);
        expect(findVariable(graphWithVars(), '   ')).toEqual([]);
    });

    it('returns empty array when nothing matches', () => {
        // Arrange / Act
        const found = findVariable(graphWithVars(), 'does_not_exist');

        // Assert
        expect(found).toEqual([]);
    });
});

describe('listVariables', () => {
    it('groups by name with usage counts', () => {
        // Arrange / Act
        const vars = listVariables(graphWithVars());

        // Assert
        expect(vars).toHaveLength(2);
        expect(vars.find((v) => v.name === 'motor_run')).toMatchObject({ name: 'motor_run', count: 2 });
        expect(vars.find((v) => v.name === 'motor_stop')).toMatchObject({ name: 'motor_stop', count: 1 });
    });

    it('collects the node ids of every usage', () => {
        // Arrange / Act
        const motor = listVariables(graphWithVars()).find((v) => v.name === 'motor_run');

        // Assert — two distinct element ids (one contact, one coil)
        expect(motor?.nodeIds).toHaveLength(2);
        expect(new Set(motor?.nodeIds).size).toBe(2);
    });

    it('orders variables alphabetically', () => {
        // Arrange / Act
        const names = listVariables(graphWithVars()).map((v) => v.name);

        // Assert
        expect(names).toEqual(['motor_run', 'motor_stop']);
    });

    it('returns empty array for an empty graph', () => {
        // Arrange / Act / Assert
        expect(listVariables(createLdGraph())).toEqual([]);
    });

    it('lists a single auto-named variable used once', () => {
        // Arrange
        const handler = new LdOperationHandler();
        const graph = handler.addRung(createLdGraph());
        const rungId = graph.rungs[0].id;
        const next = handler.addContact(graph, { position: { x: 40, y: 40 }, type: ContactType.NO, rungId });

        // Act
        const vars = listVariables(next);

        // Assert
        expect(vars).toHaveLength(1);
        expect(vars[0].name).toBe('IN0');
        expect(vars[0].count).toBe(1);
        expect(vars[0].nodeIds).toHaveLength(1);
    });
});
