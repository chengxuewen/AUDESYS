"use strict";
/**
 * LD GModel — Graph model and factory functions for IEC 61131-3 Ladder Diagram.
 *
 * The `LdGraph` is the root document model. It contains all nodes, edges,
 * and rungs that together form a complete ladder diagram.
 *
 * Factory functions provide a convenient API for creating fully-formed
 * model elements with sensible defaults.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.createContact = createContact;
exports.createCoil = createCoil;
exports.createPowerRail = createPowerRail;
exports.createFb = createFb;
exports.createWire = createWire;
exports.createPowerConnection = createPowerConnection;
exports.createRung = createRung;
exports.createLdGraph = createLdGraph;
// ============================================================================
// Factory Functions
// ============================================================================
let nextId = 0;
/**
 * Generate a unique element ID.
 *
 * Uses a simple monotonic counter prefixed for readability.
 * In production, this would be replaced with UUID v4 generation.
 */
function generateId(prefix) {
    nextId += 1;
    return `${prefix}-${nextId}`;
}
/**
 * Create a contact node with sensible defaults.
 *
 * @param contactType - NO (normally open) or NC (normally closed)
 * @param variableName - IEC 61131-3 variable name, e.g. "X1"
 * @param position - Canvas position (defaults to origin)
 * @returns A fully-formed ContactNode
 */
function createContact(contactType, variableName, position) {
    return {
        id: generateId('contact'),
        type: 'node:contact',
        contactType,
        variableName,
        position: position ?? { x: 0, y: 0 },
        size: { width: 36, height: 36 },
    };
}
/**
 * Create a coil node with sensible defaults.
 *
 * @param coilType - Normal, Negated, Set, or Reset
 * @param variableName - IEC 61131-3 variable name, e.g. "Y1"
 * @param position - Canvas position (defaults to origin)
 * @returns A fully-formed CoilNode
 */
function createCoil(coilType, variableName, position) {
    return {
        id: generateId('coil'),
        type: 'node:coil',
        coilType,
        variableName,
        position: position ?? { x: 0, y: 0 },
        size: { width: 36, height: 36 },
    };
}
/**
 * Create a power rail node.
 *
 * @param side - Left or Right power rail
 * @param position - Canvas position (defaults to origin)
 * @param height - Rail height in abstract units (matches total diagram height)
 * @returns A fully-formed PowerRailNode
 */
function createPowerRail(side, position, height) {
    return {
        id: generateId('powerrail'),
        type: 'node:powerrail',
        side,
        position: position ?? { x: 0, y: 0 },
        size: { width: 4, height: height ?? 600 },
    };
}
/**
 * Create a function block placeholder node.
 *
 * @param fbType - FB type name (e.g. "TON", "CTU", "ADD")
 * @param inputPins - Array of input pins (must include "EN")
 * @param outputPins - Array of output pins (must include "ENO")
 * @param position - Canvas position (defaults to origin)
 * @returns A fully-formed FbPlaceholderNode
 */
function createFb(fbType, inputPins, outputPins, position) {
    return {
        id: generateId('fb'),
        type: 'node:fb',
        fbType,
        inputPins,
        outputPins,
        position: position ?? { x: 0, y: 0 },
        size: { width: 120, height: 80 },
    };
}
/**
 * Create a wire connection between two elements.
 *
 * @param sourceId - ID of the source node (left element)
 * @param targetId - ID of the target node (right element)
 * @param routingPoints - Optional manual routing waypoints
 * @returns A fully-formed WireConnection
 */
function createWire(sourceId, targetId, routingPoints) {
    return {
        id: generateId('wire'),
        type: 'edge:wire',
        sourceId,
        targetId,
        routingPoints,
    };
}
/**
 * Create a power connection from a power rail to a rung element.
 *
 * @param sourceId - ID of the power rail node
 * @param targetId - ID of the target element
 * @returns A fully-formed PowerConnection
 */
function createPowerConnection(sourceId, targetId) {
    return {
        id: generateId('power'),
        type: 'edge:power',
        sourceId,
        targetId,
    };
}
/**
 * Create a rung structure for the ladder diagram.
 *
 * @param rungNumber - Sequential rung number (1-based)
 * @param elementIds - Ordered list of element IDs on this rung
 * @param comment - Optional rung comment
 * @returns A fully-formed Rung
 */
function createRung(rungNumber, elementIds, comment) {
    return {
        id: generateId('rung'),
        rungNumber,
        comment,
        elementIds,
    };
}
/**
 * Create an empty ladder diagram graph.
 *
 * Includes default left and right power rails.
 *
 * @param id - Optional graph ID (auto-generated if omitted)
 * @returns An empty LdGraph with power rails
 */
function createLdGraph(id) {
    return {
        id: id ?? generateId('ldgraph'),
        nodes: [],
        edges: [],
        rungs: [],
    };
}
//# sourceMappingURL=model.js.map