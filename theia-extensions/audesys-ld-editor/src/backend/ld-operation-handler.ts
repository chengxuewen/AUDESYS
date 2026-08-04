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

import {
  LdGraph,
  Rung,
  ParallelBranch,
  generateId,
  createContact,
  createCoil,
  createPowerRail,
  createFb,
  createRung,
  createWire,
  createLdGraph,
  createBranch,
} from '../model/model';
import {
  ContactNode,
  ContactType,
  CoilNode,
  CoilType,
  PowerRailNode,
  PowerRailSide,
  BaseNode,
  FbPlaceholderNode,
  Pin,
  Point,
} from '../model/nodes';
import { BaseEdge, WireConnection } from '../model/edges';
import { validateGraph, ValidationResult } from '../model/serialization';
import { getFbPins, getFbHeight, FB_WIDTH } from '../model/fb-catalog';


// ============================================================================
// Operation Parameter Types
// ============================================================================

export interface AddContactParams {
  position: Point;
  type: ContactType;
  rungId: string;
}

export interface AddCoilParams {
  position: Point;
  type: CoilType;
  rungId: string;
}

export interface DeleteElementParams {
  elementId: string;
}

export interface MoveElementParams {
  elementId: string;
  newPosition: Point;
  /** ponytail: grid toggle (T6) — snap:false keeps the free drag position. */
  snap?: boolean;
}

export interface ConnectWireParams {
  sourceId: string;
  targetId: string;
  routingPoints?: Point[];
}

export interface DisconnectWireParams {
  edgeId: string;
}

export interface ChangeContactTypeParams {
  elementId: string;
  newType: ContactType;
}

export interface ChangeCoilTypeParams {
  elementId: string;
  newType: CoilType;
}

export interface SetRungTitleParams {
  rungId: string;
  title: string;
}

export interface SetRungCommentParams {
  rungId: string;
  comment: string;
}

export interface SetElementCommentParams {
  elementId: string;
  comment: string;
}

export interface DeleteRungParams {
  rungId: string;
}

export interface MoveRungParams {
  rungId: string;
  newIndex: number;
}

export interface AddPowerRailParams {
  side: PowerRailSide;
}
export interface AddFbParams {
  position: Point;
  fbType: string;
  rungId: string;
}

export interface RenameVariableParams {
  elementId: string;
  variableName: string;
}

export interface OpenBranchParams {
  rungId: string;
  anchorId: string;
}

export interface CloseBranchParams {
  branchId: string;
}

export interface DeleteBranchParams {
  branchId: string;
}

export interface AddBranchContactParams {
  branchId: string;
  /** Click position — only the rung is used; x is forced to the branch column */
  position: Point;
}


// ============================================================================
// Compile Result Types
// ============================================================================

export interface CompileDiagnostic {
  severity: 'error' | 'warning';
  elementId?: string;
  line?: number;
  message: string;
  code: string;
}

export interface CompileResult {
  success: boolean;
  /** HalProgram JSON string on success, empty on failure */
  programJson: string;
  /** Diagnostics on failure, empty on success */
  diagnostics: CompileDiagnostic[];
}

// ============================================================================
// LD Source ↔ GModel Helpers (ponytail: inline, one rung at a time)
// ============================================================================

function rungToLdText(rung: Rung, graph: LdGraph): string {
  const nodeMap = new Map<string, BaseNode>();
  for (const n of graph.nodes) {
    nodeMap.set(n.id, n);
  }

  const lines: string[] = ['NETWORK'];
  for (const elemId of rung.elementIds) {
    const node = nodeMap.get(elemId);
    if (!node) continue;
    if (node.type === 'node:contact') {
      const c = node as ContactNode;
      lines.push(`  ${c.contactType} ${c.variableName}`);
    } else if (node.type === 'node:coil') {
      const c = node as CoilNode;
      const token = mapCoilTypeToLdToken(c.coilType);
      lines.push(`  ${token} ${c.variableName}`);
    }
    // Emit parallel-branch members hanging off this series element (OR/ORN).
    // Rust LD lexer: lines starting with '|' compile to OR/ORN instructions.
    for (const branch of rung.branches ?? []) {
      if (branch.anchorId !== elemId) continue;
      for (const memberId of branch.elementIds) {
        const m = nodeMap.get(memberId);
        if (!m || m.type !== 'node:contact') continue;
        const mc = m as ContactNode;
        lines.push(`  | ${mc.contactType} ${mc.variableName}`);
      }
    }
  }
  return lines.join('\n');
}

function mapCoilTypeToLdToken(coilType: CoilType): string {
  switch (coilType) {
    case CoilType.Normal:  return 'OUT';
    case CoilType.Set:     return 'SET';
    case CoilType.Reset:   return 'RESET';
    case CoilType.Negated: return 'OUT'; // ponytail: LD text has no OUTN; maps to OUT
  }
}

export function graphToLdText(graph: LdGraph): string {
  if (graph.rungs.length === 0) return 'NETWORK\n';
  return graph.rungs.map((r) => rungToLdText(r, graph)).join('\n\n');
}


// ============================================================================
// Compile Wrapper
// ============================================================================

type CompileFn = (source: string) => string;

/** Default compile function using the napi-rs bridge. */
function defaultCompile(source: string): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const bridge = require('@audesys/theia-bridge');
  return bridge.compileLd(source);
}

/**
 * Parse compile output into structured result.
 * The napi-rs `compileLd` returns a JSON string — either HalProgram on
 * success, or a diagnostic array on failure.
 */
export function parseCompileOutput(raw: string): CompileResult {
  try {
    const parsed: unknown = JSON.parse(raw);
    // Distinguish HalProgram (has `instructions`) from error array
    if (Array.isArray(parsed)) {
      return {
        success: false,
        programJson: '',
        diagnostics: parsed.map((d: Record<string, unknown>, i: number) => ({
          severity: (d.severity as 'error' | 'warning') || 'error',
          line: d.line as number | undefined,
          message: (d.message as string) || String(d),
          code: (d.code as string) || `E${String(i).padStart(3, '0')}`,
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
  } catch {
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

// Grid constants — unified 40×40 with client GridSnapper (T2.2).
// Contact column spacing (120 = 3 cells) is enforced by addContact,
// moveElement snaps to the same 40px grid as the client drag.
import { LD_GRID, CONTACT_SIZE, RAIL_WIDTH, COIL_X_OFFSET, RUNG_HEIGHT, BRANCH_FIRST_Y } from '../model/grid';
const GRID_X = LD_GRID.x; // 40 — client drag snap grid
const GRID_Y = LD_GRID.y; // 40 — matches rung 2-cell spacing

function snapToGrid(p: Point): Point {
  return {
    x: Math.round(p.x / GRID_X) * GRID_X,
    y: Math.round(p.y / GRID_Y) * GRID_Y,
  };
}
// ============================================================================
// LdOperationHandler
// ============================================================================

export class LdOperationHandler {
  private compileFn: CompileFn;

  constructor(compileFn?: CompileFn) {
    this.compileFn = compileFn ?? defaultCompile;
  }

  // ── Element CRUD ──────────────────────────────────────────

  /**
   * Add a contact node to a rung.
   * Validates: position within rung area, not right of coil.
   * Auto-connects: wire from previous contact or left power rail.
   */
  addContact(graph: LdGraph, params: AddContactParams): LdGraph {
    const rung = findRung(graph, params.rungId);
    const snapped = snapToGrid(params.position);

    // Validate: contact must be left of any existing coil
    const coilNode = findCoilOnRung(graph, rung);
    if (coilNode && snapped.x >= coilNode.position.x) {
      throw new ValidationError('Contact must be left of the coil');
    }

    // Create the contact with auto-generated variable name
    const contactCount = graph.nodes.filter(n => n.type === 'node:contact').length;
    const contact = createContact(params.type, `IN${contactCount}`, {
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
    let prevId: string | null = null;
    if (insertIdx > 0) {
      prevId = elements[insertIdx - 1];
    } else if (leftRail) {
      prevId = leftRail.id;
    }
    if (prevId) {
      const wire = createWire(prevId, contact.id);
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
        const wire = createWire(contact.id, nextTarget);
        next.edges.push(wire);
      }
    }

    // Branch-aware rewire: an inserted contact may become the new successor
    // of an existing branch — member chains re-point to it.
    rewireRungBranches(next, next.rungs[rungIdx]);

    return next;
  }

  /**
   * Add a coil node to a rung.
   * Validates: at most one coil per rung, position in coil area, contacts exist.
   */
  addCoil(graph: LdGraph, params: AddCoilParams): LdGraph {
    const rung = findRung(graph, params.rungId);
    const snapped = snapToGrid(params.position);

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

    const coilCount = graph.nodes.filter(n => n.type === 'node:coil').length;
    const coil = createCoil(params.type, `OUT${coilCount}`, { x: snapped.x, y: snapped.y });

    const next = cloneGraph(graph);
    next.nodes.push(coil);

    // Add to end of rung element list
    const rungIdx = next.rungs.findIndex((r) => r.id === rung.id);
    const elements = [...rung.elementIds, coil.id];
    next.rungs[rungIdx] = { ...rung, elementIds: elements };

    // Wire: last contact → coil
    const lastContactId = contactIds[contactIds.length - 1];
    if (lastContactId) {
      const wire = createWire(lastContactId, coil.id);
      next.edges.push(wire);
    }

    // Branch-aware rewire: branch members re-route to the new successor (coil)
    rewireRungBranches(next, next.rungs[rungIdx]);

    // Wire: coil → right power rail
    const rightRail = findRightRailOnRung(next, next.rungs[rungIdx]);
    if (rightRail) {
      const wire = createWire(coil.id, rightRail.id);
      next.edges.push(wire);
    }

    return next;
  }

  /**
   * Delete an element (contact, coil, or wire) and its connected edges.
   */
  deleteElement(graph: LdGraph, params: DeleteElementParams): LdGraph {
    const { elementId } = params;
    const node = findNode(graph, elementId);
    const edge = findEdge(graph, elementId);

    if (!node && !edge) {
      throw new ValidationError(`Element not found: ${elementId}`);
    }

    const next = cloneGraph(graph);

    if (node) {
      // Deleting a branch anchor drops the whole branch (members included).
      // Deleting a branch member prunes it from its branch (branch dies if empty).
      const dropNodeIds = new Set<string>([elementId]);
      const dropBranchIds = new Set<string>();
      for (const rung of next.rungs) {
        for (const branch of rung.branches ?? []) {
          if (branch.anchorId === elementId) {
            dropBranchIds.add(branch.id);
            for (const m of branch.elementIds) dropNodeIds.add(m);
          }
        }
      }

      // Remove connected edges (direct + cascaded members)
      next.edges = next.edges.filter(
        (e) => !dropNodeIds.has(e.sourceId) && !dropNodeIds.has(e.targetId),
      );
      next.nodes = next.nodes.filter((n) => !dropNodeIds.has(n.id));

      // Rebuild rungs: prune elementIds, branches and branch membership
      next.rungs = next.rungs.map((rung) => {
        const elementIds = rung.elementIds.filter((id) => !dropNodeIds.has(id));
        let changed = elementIds.length !== rung.elementIds.length;
        let branches = (rung.branches ?? []).filter((b) => !dropBranchIds.has(b.id));
        branches = branches.map((b) => {
          if (!b.elementIds.includes(elementId)) return b;
          changed = true;
          // Re-stack the surviving members (rows 120, 160, ...) — otherwise the
          // member keeps its old row and extent:'parent' clamps it inside the
          // shrunken rung container.
          const memberIds = b.elementIds.filter((id) => id !== elementId);
          // Re-stack the surviving members (rows 120, 160, ...) — otherwise a
          // member keeps its old row and extent:'parent' clamps it inside the
          // shrunken rung container.
          memberIds.forEach((id, idx) => {
            const member = findNode(next, id);
            if (member) {
              const ni = next.nodes.findIndex((n) => n.id === id);
              if (ni >= 0) {
                next.nodes[ni] = {
                  ...member,
                  position: { x: b.x, y: BRANCH_FIRST_Y + idx * GRID_Y },
                };
              }
            }
          });
          return { ...b, elementIds: memberIds };
        });
        const nonEmpty = branches.filter((b) => b.elementIds.length > 0);
        if (nonEmpty.length !== branches.length) changed = true;
        if (!changed) return rung;
        const updated = { ...rung, elementIds, branches: nonEmpty };
        rewireRungBranches(next, updated);
        return updated;
      });
    } else if (edge) {
      next.edges = next.edges.filter((e) => e.id !== elementId);
    }

    return next;
  }

  /**
   * Move an element to a new position.
   */
  moveElement(graph: LdGraph, params: MoveElementParams): LdGraph {
    const node = findNode(graph, params.elementId);
    if (!node) {
      throw new ValidationError(`Node not found: ${params.elementId}`);
    }

    const snapped = params.snap === false ? params.newPosition : snapToGrid(params.newPosition);
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
  connectWire(graph: LdGraph, params: ConnectWireParams): LdGraph {
    const source = findNode(graph, params.sourceId);
    const target = findNode(graph, params.targetId);

    if (!source) throw new ValidationError(`Source node not found: ${params.sourceId}`);
    if (!target) throw new ValidationError(`Target node not found: ${params.targetId}`);

    // ponytail: basic short-circuit check — both power rails
    if (
      source.type === 'node:powerrail' &&
      target.type === 'node:powerrail'
    ) {
      throw new ValidationError('Short circuit: power rails cannot connect directly');
    }

    // No connecting FROM a coil output
    if (source.type === 'node:coil') {
      throw new ValidationError('Cannot connect from a coil output');
    }

    // Prevent duplicate wires
    const existing = graph.edges.find(
      (e) => e.sourceId === params.sourceId && e.targetId === params.targetId,
    );
    if (existing) {
      return graph; // Already connected — idempotent
    }

    const wire = createWire(params.sourceId, params.targetId, params.routingPoints);
    const next = cloneGraph(graph);
    next.edges.push(wire);
    return next;
  }

  /**
   * Remove a wire connection.
   */
  disconnectWire(graph: LdGraph, params: DisconnectWireParams): LdGraph {
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
   * Change a coil's type (Normal ↔ Negated ↔ Set ↔ Reset), preserving
   * the variable name.
   */
  changeCoilType(graph: LdGraph, params: ChangeCoilTypeParams): LdGraph {
    const node = findNode(graph, params.elementId);
    if (!node || node.type !== 'node:coil') {
      throw new ValidationError(`Not a coil: ${params.elementId}`);
    }

    const coil = node as CoilNode;
    if (coil.coilType === params.newType) {
      return graph; // No change — idempotent
    }

    const next = cloneGraph(graph);
    const idx = next.nodes.findIndex((n) => n.id === params.elementId);
    if (idx >= 0) {
      const c = next.nodes[idx] as CoilNode;
      const updated: CoilNode = { ...c, coilType: params.newType };
      next.nodes[idx] = updated;
    }

    return next;
  }

  /**
   * Set a rung's network title (CODESYS-style). Empty string clears it.
   */
  setRungTitle(graph: LdGraph, params: SetRungTitleParams): LdGraph {
    const rung = findRung(graph, params.rungId);
    const title = params.title.trim();
    if (rung.title === title || (!rung.title && title === '')) {
      return graph; // No change — idempotent
    }

    const next = cloneGraph(graph);
    const rungIdx = next.rungs.findIndex((r) => r.id === rung.id);
    const updated = { ...rung, title: title === '' ? undefined : title };
    next.rungs[rungIdx] = updated;
    return next;
  }

  /**
   * Set a rung's network comment. Empty string clears it.
   */
  setRungComment(graph: LdGraph, params: SetRungCommentParams): LdGraph {
    const rung = findRung(graph, params.rungId);
    const comment = params.comment.trim();
    if (rung.comment === comment || (!rung.comment && comment === '')) {
      return graph; // No change — idempotent
    }

    const next = cloneGraph(graph);
    const rungIdx = next.rungs.findIndex((r) => r.id === rung.id);
    const updated = { ...rung, comment: comment === '' ? undefined : comment };
    next.rungs[rungIdx] = updated;
    return next;
  }

  /**
   * Set a contact/coil element comment. Empty string clears it.
   */
  setElementComment(graph: LdGraph, params: SetElementCommentParams): LdGraph {
    const node = findNode(graph, params.elementId);
    if (!node || (node.type !== 'node:contact' && node.type !== 'node:coil')) {
      throw new ValidationError(`Not a contact or coil: ${params.elementId}`);
    }
    const comment = params.comment.trim();
    const current = (node as ContactNode | CoilNode).comment;
    if (current === comment || (!current && comment === '')) {
      return graph; // No change — idempotent
    }

    const next = cloneGraph(graph);
    const idx = next.nodes.findIndex((n) => n.id === params.elementId);
    if (idx >= 0) {
      const n = next.nodes[idx] as ContactNode | CoilNode;
      next.nodes[idx] = {
        ...n,
        comment: comment === '' ? undefined : comment,
      } as ContactNode | CoilNode;
    }
    return next;
  }
  /**
   * Change a contact's type (NO ↔ NC).
   */
  changeContactType(graph: LdGraph, params: ChangeContactTypeParams): LdGraph {
    const node = findNode(graph, params.elementId);
    if (!node || node.type !== 'node:contact') {
      throw new ValidationError(`Not a contact: ${params.elementId}`);
    }

    const contact = node as ContactNode;
    if (contact.contactType === params.newType) {
      return graph; // No change — idempotent
    }

    const next = cloneGraph(graph);
    const idx = next.nodes.findIndex((n) => n.id === params.elementId);
    if (idx >= 0) {
      const c = next.nodes[idx] as ContactNode;
      const updated: ContactNode = { ...c, contactType: params.newType };
      next.nodes[idx] = updated;
    }

    return next;
  }

  // ── Rung Management ───────────────────────────────────────

  /**
   * Add a new empty rung at the end of the diagram.
   */
  addRung(graph: LdGraph): LdGraph {
    const next = cloneGraph(graph);
    const rungNumber = next.rungs.length + 1;
    const rung = createRung(rungNumber, [], rungNumber === 1 ? 'Main' : undefined);
    next.rungs.push(rung);

    // Auto-add power rails if this is the first rung
    if (rungNumber === 1) {
      const totalHeight = (next.rungs.length + 1) * GRID_Y;
      const leftRail = createPowerRail(PowerRailSide.Left, { x: 0, y: 0 }, totalHeight);
      const rightRail = createPowerRail(PowerRailSide.Right, {
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
  deleteRung(graph: LdGraph, params: DeleteRungParams): LdGraph {
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
    next.edges = next.edges.filter(
      (e) => !elementIds.has(e.sourceId) && !elementIds.has(e.targetId),
    );

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
  moveRung(graph: LdGraph, params: MoveRungParams): LdGraph {
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
  addPowerRail(graph: LdGraph, params: AddPowerRailParams): LdGraph {
    // Check if rail already exists on this side
    const existing = graph.nodes.find(
      (n): n is PowerRailNode =>
        n.type === 'node:powerrail' &&
        (n as PowerRailNode).side === params.side,
    );
    if (existing) {
      return graph; // Already has a rail on this side — idempotent
    }

    const x = params.side === PowerRailSide.Left ? 0 : COIL_X_OFFSET + CONTACT_SIZE + RAIL_WIDTH;
    const rail = createPowerRail(params.side, { x, y: 0 });

    const next = cloneGraph(graph);
    next.nodes.push(rail);
    return next;
  }
  addFb(graph: LdGraph, params: AddFbParams): LdGraph {
    const rung = findRung(graph, params.rungId);
    const snapped = snapToGrid(params.position);

    // Pins come from the FB catalog (IEC 61131-3 pin sets per type)
    const pins = getFbPins(params.fbType);
    if (!pins) {
      throw new ValidationError(`Unknown FB type: ${params.fbType}`);
    }

    const fb = createFb(params.fbType, pins.inputPins, pins.outputPins, snapped);
    fb.size = { width: FB_WIDTH, height: getFbHeight(params.fbType) };

    const next = cloneGraph(graph);
    next.nodes.push(fb);

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
    elements.splice(insertIdx, 0, fb.id);
    const rungIdx = next.rungs.findIndex((r) => r.id === rung.id);
    next.rungs[rungIdx] = { ...rung, elementIds: elements };

    // Auto-connect: predecessor to EN, ENO to successor (pin-anchored wires)
    const prevId = insertIdx > 0 ? elements[insertIdx - 1] : findLeftRailOnRung(next, next.rungs[rungIdx])?.id;
    if (prevId) {
      const wire = createWire(prevId, fb.id);
      wire.targetPin = 'EN';
      next.edges.push(wire);
    }
    const succId = elements[insertIdx + 1]
      ?? findCoilOnRung(next, next.rungs[rungIdx])?.id
      ?? findRightRailOnRung(next, next.rungs[rungIdx])?.id;
    if (succId) {
      const wire = createWire(fb.id, succId);
      wire.sourcePin = 'ENO';
      next.edges.push(wire);
    }

    // Branch-aware rewire: the FB may become a branch's new successor
    rewireRungBranches(next, next.rungs[rungIdx]);

    return next;
  }

  // ── Variable Rename ──────────────────────────────────────

  /**
   * Rename the variable bound to a contact or coil.
   * Validates: element is a contact/coil, name non-empty and whitespace-free.
   */
  renameVariable(graph: LdGraph, params: RenameVariableParams): LdGraph {
    const node = findNode(graph, params.elementId);
    if (!node || (node.type !== 'node:contact' && node.type !== 'node:coil')) {
      throw new ValidationError(`Not a contact or coil: ${params.elementId}`);
    }
    const name = params.variableName.trim();
    if (name.length === 0) {
      throw new ValidationError('Variable name cannot be empty');
    }
    if (/\s/.test(name)) {
      throw new ValidationError('Variable name cannot contain whitespace');
    }
    const current = (node as ContactNode | CoilNode).variableName;
    if (name === current) {
      return graph; // No change - idempotent
    }

    const next = cloneGraph(graph);
    const idx = next.nodes.findIndex((n) => n.id === params.elementId);
    if (idx >= 0) {
      const node = next.nodes[idx] as ContactNode | CoilNode;
      next.nodes[idx] = { ...node, variableName: name } as ContactNode | CoilNode;
    }
    return next;
  }

  // ── Parallel Branches ────────────────────────────────────

  /**
   * Open a parallel branch hanging off a series contact (the anchor).
   * The anchor stays in the series chain; members are added via addBranchContact.
   */
  openBranch(graph: LdGraph, params: OpenBranchParams): LdGraph {
    const rung = findRung(graph, params.rungId);
    const anchor = findNode(graph, params.anchorId);
    if (!anchor || anchor.type !== 'node:contact') {
      throw new ValidationError('Branch anchor must be a contact');
    }
    if (!rung.elementIds.includes(params.anchorId)) {
      throw new ValidationError('Anchor is not on this rung');
    }
    const branches = rung.branches ?? [];
    if (branches.some((b) => b.anchorId === params.anchorId)) {
      throw new ValidationError('A branch already exists at this contact');
    }

    const next = cloneGraph(graph);
    const branch = createBranch(rung.id, params.anchorId, anchor.position.x);
    const rungIdx = next.rungs.findIndex((r) => r.id === rung.id);
    next.rungs[rungIdx] = { ...rung, branches: [...branches, branch] };
    return next;
  }

  /**
   * Add a contact to a parallel branch (stacked below the anchor).
   * x is forced to the branch column; y stacks at 120, 160, 200...
   */
  addBranchContact(graph: LdGraph, params: AddBranchContactParams): LdGraph {
    const { branch } = findBranch(graph, params.branchId);
    const rung = findRung(graph, branch.rungId);

    const contactCount = graph.nodes.filter((n) => n.type === 'node:contact').length;
    const contact = createContact(ContactType.NO, `IN${contactCount}`, {
      x: branch.x,
      y: BRANCH_FIRST_Y + branch.elementIds.length * GRID_Y,
    });

    const next = cloneGraph(graph);
    next.nodes.push(contact);

    const rungIdx = next.rungs.findIndex((r) => r.id === rung.id);
    const branches = (rung.branches ?? []).map((b) =>
      b.id === branch.id ? { ...b, elementIds: [...b.elementIds, contact.id] } : b,
    );
    const updatedRung = { ...rung, branches };
    next.rungs[rungIdx] = updatedRung;

    rewireRungBranches(next, updatedRung);
    return next;
  }

  /**
   * Close a parallel branch — validates it has at least one member.
   * The branch stays in the model ("closed" is a UX phase, not a model state).
   */
  closeBranch(graph: LdGraph, params: CloseBranchParams): LdGraph {
    const { branch } = findBranch(graph, params.branchId);
    if (branch.elementIds.length === 0) {
      throw new ValidationError('Cannot close an empty branch - add at least one contact');
    }
    return graph; // validation only
  }

  /**
   * Delete a parallel branch: removes members (nodes + edges) and the
   * branch record, then restores the series edge anchor-to-successor.
   */
  deleteBranch(graph: LdGraph, params: DeleteBranchParams): LdGraph {
    const { rung, branch } = findBranch(graph, params.branchId);
    const memberIds = new Set(branch.elementIds);

    const next = cloneGraph(graph);
    next.nodes = next.nodes.filter((n) => !memberIds.has(n.id));
    next.edges = next.edges.filter(
      (e) => !memberIds.has(e.sourceId) && !memberIds.has(e.targetId),
    );

    const rungIdx = next.rungs.findIndex((r) => r.id === rung.id);
    const updatedRung = {
      ...rung,
      branches: (rung.branches ?? []).filter((b) => b.id !== branch.id),
    };
    next.rungs[rungIdx] = updatedRung;

    rewireRungBranches(next, updatedRung);

    // Restore the series edge for the deleted branch's anchor
    const succ = seriesSuccessor(updatedRung, branch.anchorId);
    if (succ) {
      const exists = next.edges.some(
        (e) => e.sourceId === branch.anchorId && e.targetId === succ,
      );
      if (!exists) {
        next.edges.push(createWire(branch.anchorId, succ));
      }
    }
    return next;
  }

  /**
   * Validate the structural integrity of a ladder diagram.
   * Uses the existing `validateGraph` from gmodel/serialization,
   * plus additional LD-specific rules.
   */
  validate(graph: LdGraph): ValidationResult {
    // Run structural validation
    const structural = validateGraph(graph);

    // Filter: power rails are intentionally not in rung elementIds
    const filteredErrors = structural.errors.filter(
      (e) => !e.includes('node:powerrail'),
    );
    const ldErrors: string[] = [];

    for (const rung of graph.rungs) {
      const rungNodes = rung.elementIds
        .map((id) => findNode(graph, id))
        .filter(Boolean) as BaseNode[];

      // Check: at most one coil per rung
      const coils = rungNodes.filter((n) => n.type === 'node:coil');
      if (coils.length > 1) {
        ldErrors.push(
          `Rung ${rung.rungNumber}: multiple coils (${coils.length}) — only one allowed`,
        );
      }

      // Check: coils must be rightmost
      const contacts = rungNodes.filter((n) => n.type === 'node:contact');
      if (coils.length > 0 && contacts.length > 0) {
        const rightmostContactX = Math.max(...contacts.map((c) => c.position.x));
        const leftmostCoilX = Math.min(...coils.map((c) => c.position.x));
        if (leftmostCoilX <= rightmostContactX) {
          ldErrors.push(
            `Rung ${rung.rungNumber}: coil must be to the right of all contacts`,
          );
        }
      }

      // Check: at least one contact if there's a coil (FB-only rungs allowed
      // - FB nodes provide the condition but do not compile to LD text)
      const fbNodes = rungNodes.filter((n) => n.type === 'node:fb');
      if (coils.length > 0 && contacts.length === 0 && fbNodes.length === 0) {
        ldErrors.push(
          `Rung ${rung.rungNumber}: has a coil but no contacts`,
        );
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
  compile(graph: LdGraph): CompileResult {
    // Pre-validate
    const validation = this.validate(graph);
    if (!validation.valid) {
      return {
        success: false,
        programJson: '',
        diagnostics: validation.errors.map((msg, i) => ({
          severity: 'error' as const,
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
    } catch (err) {
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

// ============================================================================
// Helpers
// ============================================================================

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function cloneGraph(graph: LdGraph): LdGraph {
  return JSON.parse(JSON.stringify(graph));
}

function findRung(graph: LdGraph, rungId: string): Rung {
  const rung = graph.rungs.find((r) => r.id === rungId);
  if (!rung) throw new ValidationError(`Rung not found: ${rungId}`);
  return rung;
}

function findNode(graph: LdGraph, nodeId: string): BaseNode | undefined {
  return graph.nodes.find((n) => n.id === nodeId);
}

function findEdge(graph: LdGraph, edgeId: string): BaseEdge | undefined {
  return graph.edges.find((e) => e.id === edgeId);
}

function findCoilOnRung(graph: LdGraph, rung: Rung): CoilNode | undefined {
  for (const elemId of rung.elementIds) {
    const n = findNode(graph, elemId);
    if (n?.type === 'node:coil') return n as CoilNode;
  }
  return undefined;
}

function findLeftRailOnRung(graph: LdGraph, rung: Rung): PowerRailNode | undefined {
  // ponytail: O(n) scan for left rail — acceptable for <100 elements
  return graph.nodes.find(
    (n): n is PowerRailNode =>
      n.type === 'node:powerrail' && (n as PowerRailNode).side === PowerRailSide.Left,
  ) as PowerRailNode | undefined;
}

function findRightRailOnRung(graph: LdGraph, rung: Rung): PowerRailNode | undefined {
  return graph.nodes.find(
    (n): n is PowerRailNode =>
      n.type === 'node:powerrail' && (n as PowerRailNode).side === PowerRailSide.Right,
  ) as PowerRailNode | undefined;
}

function findBranch(graph: LdGraph, branchId: string): { rung: Rung; branch: ParallelBranch } {
  for (const rung of graph.rungs) {
    const branch = (rung.branches ?? []).find((b) => b.id === branchId);
    if (branch) return { rung, branch };
  }
  throw new ValidationError(`Branch not found: ${branchId}`);
}

/** Next series element after the anchor in rung.elementIds (may be a coil). */
function seriesSuccessor(rung: Rung, anchorId: string): string | null {
  const idx = rung.elementIds.indexOf(anchorId);
  if (idx < 0 || idx + 1 >= rung.elementIds.length) return null;
  return rung.elementIds[idx + 1];
}

/**
 * Rewire all branches of a rung: drops old branch edges (member-touching
 * and anchor-to-successor) and re-creates them from scratch.
 *
 * Edge layout per branch (N members, anchor a, successor s):
 *   a -m1 (horizontal), m1 | m2 | ... | mN (vertical bus), mN -s (horizontal)
 */
function rewireRungBranches(next: LdGraph, rung: Rung): void {
  const branches = rung.branches ?? [];
  if (branches.length === 0) return;

  const memberIds = new Set<string>();
  for (const b of branches) {
    for (const m of b.elementIds) memberIds.add(m);
  }

  // Drop old branch edges
  next.edges = next.edges.filter((e) => {
    if (memberIds.has(e.sourceId) || memberIds.has(e.targetId)) return false;
    for (const b of branches) {
      const succ = seriesSuccessor(rung, b.anchorId);
      if (succ && e.sourceId === b.anchorId && e.targetId === succ) return false;
    }
    return true;
  });

  // Re-create edges
  for (const b of branches) {
    const succ = seriesSuccessor(rung, b.anchorId);
    if (b.elementIds.length === 0) {
      if (succ) next.edges.push(createWire(b.anchorId, succ));
      continue;
    }
    const first = b.elementIds[0];
    const last = b.elementIds[b.elementIds.length - 1];
    next.edges.push(createWire(b.anchorId, first));
    for (let i = 0; i < b.elementIds.length - 1; i++) {
      const w = createWire(b.elementIds[i], b.elementIds[i + 1]);
      w.sourcePin = 'bus-out';
      w.targetPin = 'bus-in';
      next.edges.push(w);
    }
    const target = succ ?? findRightRailOnRung(next, rung)?.id ?? null;
    if (target) {
      // Last member re-joins the series via its right-hand out handle
      next.edges.push(createWire(last, target));
    }
  }
}
