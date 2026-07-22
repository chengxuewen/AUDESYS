"use strict";
/**
 * LD Operation Handler — thin dispatch layer for Ladder Diagram GLSP operations.
 *
 * Each operation handler receives the current `LdGraph` state and operation
 * parameters, validates the request, and returns an updated `LdGraph` delta.
 *
 * This is a THIN server — validation + dispatch only. Complex layout logic
 * belongs to T2a.4 (Rust Layout Engine). The handlers call napi-rs
 * `compileLd` for compilation, with a fallback for testing.
 *
 * Ponytail: one class, one file. No per-operation handler classes —
 * they'd be single-method boilerplate. No inversify DI until GLSP
 * integration needs it.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LdOperationHandler = void 0;
const model_1 = require("../gmodel/model");
const nodes_1 = require("../gmodel/nodes");
const serialization_1 = require("../gmodel/serialization");
// ============================================================================
// LD Source ↔ GModel Helpers (ponytail: inline, one rung at a time)
// ============================================================================
function rungToLdText(rung, graph) {
    const nodeMap = new Map();
    for (const n of graph.nodes) {
        nodeMap.set(n.id, n);
    }
    const lines = ['NETWORK'];
    for (const elemId of rung.elementIds) {
        const node = nodeMap.get(elemId);
        if (!node)
            continue;
        if (node.type === 'node:contact') {
            const c = node;
            lines.push(`  ${c.contactType} ${c.variableName}`);
        }
        else if (node.type === 'node:coil') {
            const c = node;
            lines.push(`  ${c.coilType} ${c.variableName}`);
        }
    }
    return lines.join('\n');
}
function graphToLdText(graph) {
    if (graph.rungs.length === 0)
        return 'NETWORK\n';
    return graph.rungs.map((r) => rungToLdText(r, graph)).join('\n\n');
}
/** Default compile function using the napi-rs bridge. */
function defaultCompile(source) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bridge = require('@audesys/theia-bridge');
    return bridge.compileLd(source);
}
/**
 * Parse compile output into structured result.
 * The napi-rs `compileLd` returns a JSON string — either HalProgram on
 * success, or a diagnostic array on failure.
 */
function parseCompileOutput(raw) {
    try {
        const parsed = JSON.parse(raw);
        // Distinguish HalProgram (has `instructions`) from error array
        if (Array.isArray(parsed)) {
            return {
                success: false,
                programJson: '',
                diagnostics: parsed.map((d, i) => ({
                    severity: d.severity || 'error',
                    line: d.line,
                    message: d.message || String(d),
                    code: d.code || `E${String(i).padStart(3, '0')}`,
                })),
            };
        }
        if (typeof parsed === 'object' && parsed !== null && 'instructions' in parsed) {
            return {
                success: true,
                programJson: raw,
                diagnostics: [],
            };
        }
        // Unknown format
        return {
            success: false,
            programJson: '',
            diagnostics: [{ severity: 'error', message: 'Unknown compile output format', code: 'E999' }],
        };
    }
    catch {
        // Not JSON — likely a raw error string
        return {
            success: false,
            programJson: '',
            diagnostics: [{ severity: 'error', message: raw, code: 'E998' }],
        };
    }
}
// ============================================================================
// Snapping Helpers
// ============================================================================
const GRID_X = 120; // Contact horizontal spacing
const GRID_Y = 80; // Rung vertical spacing
const CONTACT_SIZE = 36;
const RAIL_WIDTH = 4;
const COIL_X_OFFSET = 600; // ponytail: fixed offset, T2a.4 layout engine replaces
function snapToGrid(p) {
    return {
        x: Math.round(p.x / GRID_X) * GRID_X,
        y: Math.round(p.y / GRID_Y) * GRID_Y,
    };
}
// ============================================================================
// LdOperationHandler
// ============================================================================
class LdOperationHandler {
    constructor(compileFn) {
        this.compileFn = compileFn ?? defaultCompile;
    }
    // ── Element CRUD ──────────────────────────────────────────
    /**
     * Add a contact node to a rung.
     * Validates: position within rung area, not right of coil.
     * Auto-connects: wire from previous contact or left power rail.
     */
    addContact(graph, params) {
        const rung = findRung(graph, params.rungId);
        const snapped = snapToGrid(params.position);
        // Validate: contact must be left of any existing coil
        const coilNode = findCoilOnRung(graph, rung);
        if (coilNode && snapped.x >= coilNode.position.x) {
            throw new ValidationError('Contact must be left of the coil');
        }
        // Create the contact
        const contact = (0, model_1.createContact)(params.type, '??', {
            x: snapped.x,
            y: snapped.y,
        });
        // Build updated graph
        const next = cloneGraph(graph);
        next.nodes.push(contact);
        // Add to rung element list (maintain left-to-right order by x)
        const elements = [...rung.elementIds];
        let insertIdx = elements.length;
        for (let i = 0; i < elements.length; i++) {
            const n = findNode(graph, elements[i]);
            if (n && n.position.x > snapped.x) {
                insertIdx = i;
                break;
            }
        }
        elements.splice(insertIdx, 0, contact.id);
        const rungIdx = next.rungs.findIndex((r) => r.id === rung.id);
        next.rungs[rungIdx] = { ...rung, elementIds: elements };
        // Auto-connect: wire from previous contact or left power rail
        const leftRail = findLeftRailOnRung(next, next.rungs[rungIdx]);
        let prevId = null;
        if (insertIdx > 0) {
            prevId = elements[insertIdx - 1];
        }
        else if (leftRail) {
            prevId = leftRail.id;
        }
        if (prevId) {
            const wire = (0, model_1.createWire)(prevId, contact.id);
            next.edges.push(wire);
        }
        // If this is the last element, connect to coil or right rail
        if (insertIdx === elements.length - 1) {
            let nextTarget = coilNode?.id;
            if (!nextTarget) {
                const rightRail = findRightRailOnRung(next, next.rungs[rungIdx]);
                nextTarget = rightRail?.id;
            }
            if (nextTarget) {
                const wire = (0, model_1.createWire)(contact.id, nextTarget);
                next.edges.push(wire);
            }
        }
        return next;
    }
    /**
     * Add a coil node to a rung.
     * Validates: at most one coil per rung, position in coil area, contacts exist.
     */
    addCoil(graph, params) {
        const rung = findRung(graph, params.rungId);
        const snapped = snapToGrid(params.position);
        // At most one coil per rung
        if (findCoilOnRung(graph, rung)) {
            throw new ValidationError('Rung already has a coil');
        }
        // Must have at least one contact before adding a coil
        const contactIds = rung.elementIds.filter((id) => {
            const n = findNode(graph, id);
            return n?.type === 'node:contact';
        });
        if (contactIds.length === 0) {
            throw new ValidationError('Add at least one contact before adding a coil');
        }
        // Valid position: right of the rightmost contact
        const rightmostX = contactIds.reduce((maxX, id) => {
            const n = findNode(graph, id);
            return n ? Math.max(maxX, n.position.x) : maxX;
        }, 0);
        if (snapped.x <= rightmostX) {
            throw new ValidationError('Coil must be placed to the right of all contacts');
        }
        const coil = (0, model_1.createCoil)(params.type, '??', { x: snapped.x, y: snapped.y });
        const next = cloneGraph(graph);
        next.nodes.push(coil);
        // Add to end of rung element list
        const rungIdx = next.rungs.findIndex((r) => r.id === rung.id);
        const elements = [...rung.elementIds, coil.id];
        next.rungs[rungIdx] = { ...rung, elementIds: elements };
        // Wire: last contact → coil
        const lastContactId = contactIds[contactIds.length - 1];
        if (lastContactId) {
            const wire = (0, model_1.createWire)(lastContactId, coil.id);
            next.edges.push(wire);
        }
        // Wire: coil → right power rail
        const rightRail = findRightRailOnRung(next, next.rungs[rungIdx]);
        if (rightRail) {
            const wire = (0, model_1.createWire)(coil.id, rightRail.id);
            next.edges.push(wire);
        }
        return next;
    }
    /**
     * Delete an element (contact, coil, or wire) and its connected edges.
     */
    deleteElement(graph, params) {
        const { elementId } = params;
        const node = findNode(graph, elementId);
        const edge = findEdge(graph, elementId);
        if (!node && !edge) {
            throw new ValidationError(`Element not found: ${elementId}`);
        }
        const next = cloneGraph(graph);
        if (node) {
            // Remove connected edges
            next.edges = next.edges.filter((e) => e.sourceId !== elementId && e.targetId !== elementId);
            // Remove from node list
            next.nodes = next.nodes.filter((n) => n.id !== elementId);
            // Remove from rung element lists
            for (let i = 0; i < next.rungs.length; i++) {
                const rung = next.rungs[i];
                if (rung.elementIds.includes(elementId)) {
                    next.rungs[i] = {
                        ...rung,
                        elementIds: rung.elementIds.filter((id) => id !== elementId),
                    };
                }
            }
        }
        else if (edge) {
            next.edges = next.edges.filter((e) => e.id !== elementId);
        }
        return next;
    }
    /**
     * Move an element to a new position.
     */
    moveElement(graph, params) {
        const node = findNode(graph, params.elementId);
        if (!node) {
            throw new ValidationError(`Node not found: ${params.elementId}`);
        }
        const snapped = snapToGrid(params.newPosition);
        const next = cloneGraph(graph);
        const idx = next.nodes.findIndex((n) => n.id === params.elementId);
        if (idx >= 0) {
            next.nodes[idx] = { ...next.nodes[idx], position: snapped };
        }
        return next;
    }
    // ── Wiring ────────────────────────────────────────────────
    /**
     * Create a wire connection between two elements.
     * Validates: source and target exist, no direct power rail short.
     */
    connectWire(graph, params) {
        const source = findNode(graph, params.sourceId);
        const target = findNode(graph, params.targetId);
        if (!source)
            throw new ValidationError(`Source node not found: ${params.sourceId}`);
        if (!target)
            throw new ValidationError(`Target node not found: ${params.targetId}`);
        // ponytail: basic short-circuit check — both power rails
        if (source.type === 'node:powerrail' &&
            target.type === 'node:powerrail') {
            throw new ValidationError('Short circuit: power rails cannot connect directly');
        }
        // No connecting FROM a coil output
        if (source.type === 'node:coil') {
            throw new ValidationError('Cannot connect from a coil output');
        }
        // Prevent duplicate wires
        const existing = graph.edges.find((e) => e.sourceId === params.sourceId && e.targetId === params.targetId);
        if (existing) {
            return graph; // Already connected — idempotent
        }
        const wire = (0, model_1.createWire)(params.sourceId, params.targetId, params.routingPoints);
        const next = cloneGraph(graph);
        next.edges.push(wire);
        return next;
    }
    /**
     * Remove a wire connection.
     */
    disconnectWire(graph, params) {
        const edge = findEdge(graph, params.edgeId);
        if (!edge) {
            throw new ValidationError(`Wire not found: ${params.edgeId}`);
        }
        const next = cloneGraph(graph);
        next.edges = next.edges.filter((e) => e.id !== params.edgeId);
        return next;
    }
    // ── Property Changes ─────────────────────────────────────
    /**
     * Change a contact's type (NO ↔ NC).
     */
    changeContactType(graph, params) {
        const node = findNode(graph, params.elementId);
        if (!node || node.type !== 'node:contact') {
            throw new ValidationError(`Not a contact: ${params.elementId}`);
        }
        const contact = node;
        if (contact.contactType === params.newType) {
            return graph; // No change — idempotent
        }
        const next = cloneGraph(graph);
        const idx = next.nodes.findIndex((n) => n.id === params.elementId);
        if (idx >= 0) {
            const c = next.nodes[idx];
            const updated = { ...c, contactType: params.newType };
            next.nodes[idx] = updated;
        }
        return next;
    }
    // ── Rung Management ───────────────────────────────────────
    /**
     * Add a new empty rung at the end of the diagram.
     */
    addRung(graph) {
        const next = cloneGraph(graph);
        const rungNumber = next.rungs.length + 1;
        const rung = (0, model_1.createRung)(rungNumber, [], rungNumber === 1 ? 'Main' : undefined);
        next.rungs.push(rung);
        // Auto-add power rails if this is the first rung
        if (rungNumber === 1) {
            const totalHeight = (next.rungs.length + 1) * GRID_Y;
            const leftRail = (0, model_1.createPowerRail)(nodes_1.PowerRailSide.Left, { x: 0, y: 0 }, totalHeight);
            const rightRail = (0, model_1.createPowerRail)(nodes_1.PowerRailSide.Right, {
                x: COIL_X_OFFSET + CONTACT_SIZE + RAIL_WIDTH,
                y: 0,
            }, totalHeight);
            next.nodes.push(leftRail, rightRail);
        }
        return next;
    }
    /**
     * Delete a rung and all its elements.
     * Validates: at least one rung must remain after deletion.
     */
    deleteRung(graph, params) {
        const rungIdx = graph.rungs.findIndex((r) => r.id === params.rungId);
        if (rungIdx < 0) {
            throw new ValidationError(`Rung not found: ${params.rungId}`);
        }
        if (graph.rungs.length <= 1) {
            throw new ValidationError('Cannot delete the last rung');
        }
        const rung = graph.rungs[rungIdx];
        const next = cloneGraph(graph);
        // Remove elements referenced by this rung
        const elementIds = new Set(rung.elementIds);
        next.nodes = next.nodes.filter((n) => !elementIds.has(n.id));
        // Remove edges connected to those elements
        next.edges = next.edges.filter((e) => !elementIds.has(e.sourceId) && !elementIds.has(e.targetId));
        // Remove the rung
        next.rungs.splice(rungIdx, 1);
        // Renumber remaining rungs
        for (let i = 0; i < next.rungs.length; i++) {
            next.rungs[i] = { ...next.rungs[i], rungNumber: i + 1 };
        }
        return next;
    }
    /**
     * Reorder rungs by moving one to a new index.
     */
    moveRung(graph, params) {
        const rungIdx = graph.rungs.findIndex((r) => r.id === params.rungId);
        if (rungIdx < 0) {
            throw new ValidationError(`Rung not found: ${params.rungId}`);
        }
        const clampedIdx = Math.max(0, Math.min(params.newIndex, graph.rungs.length - 1));
        if (rungIdx === clampedIdx) {
            return graph; // No-op
        }
        const next = cloneGraph(graph);
        const [moved] = next.rungs.splice(rungIdx, 1);
        next.rungs.splice(clampedIdx, 0, moved);
        // Renumber
        for (let i = 0; i < next.rungs.length; i++) {
            next.rungs[i] = { ...next.rungs[i], rungNumber: i + 1 };
        }
        return next;
    }
    // ── Power Rail ────────────────────────────────────────────
    /**
     * Add a power rail to the diagram.
     */
    addPowerRail(graph, params) {
        // Check if rail already exists on this side
        const existing = graph.nodes.find((n) => n.type === 'node:powerrail' &&
            n.side === params.side);
        if (existing) {
            return graph; // Already has a rail on this side — idempotent
        }
        const x = params.side === nodes_1.PowerRailSide.Left ? 0 : COIL_X_OFFSET + CONTACT_SIZE + RAIL_WIDTH;
        const rail = (0, model_1.createPowerRail)(params.side, { x, y: 0 });
        const next = cloneGraph(graph);
        next.nodes.push(rail);
        return next;
    }
    // ── Validation & Compilation ──────────────────────────────
    /**
     * Validate the structural integrity of a ladder diagram.
     * Uses the existing `validateGraph` from gmodel/serialization,
     * plus additional LD-specific rules.
     */
    validate(graph) {
        // Run structural validation
        const structural = (0, serialization_1.validateGraph)(graph);
        // Filter: power rails are intentionally not in rung elementIds
        const filteredErrors = structural.errors.filter((e) => !e.includes('node:powerrail'));
        const ldErrors = [];
        for (const rung of graph.rungs) {
            const rungNodes = rung.elementIds
                .map((id) => findNode(graph, id))
                .filter(Boolean);
            // Check: at most one coil per rung
            const coils = rungNodes.filter((n) => n.type === 'node:coil');
            if (coils.length > 1) {
                ldErrors.push(`Rung ${rung.rungNumber}: multiple coils (${coils.length}) — only one allowed`);
            }
            // Check: coils must be rightmost
            const contacts = rungNodes.filter((n) => n.type === 'node:contact');
            if (coils.length > 0 && contacts.length > 0) {
                const rightmostContactX = Math.max(...contacts.map((c) => c.position.x));
                const leftmostCoilX = Math.min(...coils.map((c) => c.position.x));
                if (leftmostCoilX <= rightmostContactX) {
                    ldErrors.push(`Rung ${rung.rungNumber}: coil must be to the right of all contacts`);
                }
            }
            // Check: at least one contact if there's a coil
            if (coils.length > 0 && contacts.length === 0) {
                ldErrors.push(`Rung ${rung.rungNumber}: has a coil but no contacts`);
            }
        }
        const allErrors = [...filteredErrors, ...ldErrors];
        return {
            valid: allErrors.length === 0,
            errors: allErrors,
        };
    }
    /**
     * Compile the ladder diagram: GModel → LD text → napi-rs compileLd → HalProgram.
     *
     * Validates first, then compiles. Returns structured result with
     * diagnostics on failure.
     */
    compile(graph) {
        // Pre-validate
        const validation = this.validate(graph);
        if (!validation.valid) {
            return {
                success: false,
                programJson: '',
                diagnostics: validation.errors.map((msg, i) => ({
                    severity: 'error',
                    message: msg,
                    code: `V${String(i + 1).padStart(3, '0')}`,
                })),
            };
        }
        // Convert graph to LD text
        const ldSource = graphToLdText(graph);
        try {
            const raw = this.compileFn(ldSource);
            return parseCompileOutput(raw);
        }
        catch (err) {
            return {
                success: false,
                programJson: '',
                diagnostics: [
                    {
                        severity: 'error',
                        message: err instanceof Error ? err.message : String(err),
                        code: 'E999',
                    },
                ],
            };
        }
    }
}
exports.LdOperationHandler = LdOperationHandler;
// ============================================================================
// Helpers
// ============================================================================
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
function cloneGraph(graph) {
    return JSON.parse(JSON.stringify(graph));
}
function findRung(graph, rungId) {
    const rung = graph.rungs.find((r) => r.id === rungId);
    if (!rung)
        throw new ValidationError(`Rung not found: ${rungId}`);
    return rung;
}
function findNode(graph, nodeId) {
    return graph.nodes.find((n) => n.id === nodeId);
}
function findEdge(graph, edgeId) {
    return graph.edges.find((e) => e.id === edgeId);
}
function findCoilOnRung(graph, rung) {
    for (const elemId of rung.elementIds) {
        const n = findNode(graph, elemId);
        if (n?.type === 'node:coil')
            return n;
    }
    return undefined;
}
function findLeftRailOnRung(graph, rung) {
    // ponytail: O(n) scan for left rail — acceptable for <100 elements
    return graph.nodes.find((n) => n.type === 'node:powerrail' && n.side === nodes_1.PowerRailSide.Left);
}
function findRightRailOnRung(graph, rung) {
    return graph.nodes.find((n) => n.type === 'node:powerrail' && n.side === nodes_1.PowerRailSide.Right);
}
//# sourceMappingURL=ld-operation-handler.js.map