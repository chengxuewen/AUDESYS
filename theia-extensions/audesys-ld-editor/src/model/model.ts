/**
 * LD GModel — Graph model and factory functions for IEC 61131-3 Ladder Diagram.
 *
 * The `LdGraph` is the root document model. It contains all nodes, edges,
 * and rungs that together form a complete ladder diagram.
 *
 * Factory functions provide a convenient API for creating fully-formed
 * model elements with sensible defaults.
 */

import {
  BaseNode,
  ContactNode,
  ContactType,
  CoilNode,
  CoilType,
  PowerRailNode,
  PowerRailSide,
  FbPlaceholderNode,
  ComparisonNode,
  ComparisonOperator,
  Pin,
  Point,
  Dimension,
} from './nodes';
import { BaseEdge, WireConnection, PowerConnection } from './edges';

// ============================================================================
// Rung
// ============================================================================

/**
 * A single rung in the ladder diagram.
 *
 * Each rung represents one logical row of the ladder. It contains
 * a sequence of elements (contacts in series/parallel, optional
 * function blocks, and one or more coils) connected by wires between
 * the left and right power rails.
 *
 * Rungs are evaluated top-to-bottom, each in one scan cycle.
 */
export interface Rung {
  /** Unique identifier (UUID v4) */
  id: string;
  /** Sequential rung number starting from 1 (displayed as 001, 002, ...) */
  rungNumber: number;
  /** Optional user comment describing the rung's purpose */
  comment?: string;
  /** Optional network title (CODESYS-style), shown on the rung header line 1 */
  title?: string;
  /** Ordered list of element IDs on this rung (left-to-right) */
  /** Ordered list of element IDs on this rung (left-to-right) */
  elementIds: string[];
  /**
   * Optional parallel branches (OR groups) on this rung.
   * Each branch hangs off a series element (the anchor) at one column;
   * its members are stacked vertically below the anchor and compile
   * to OR/ORN instructions. Absent for older .ld files.
   */
  branches?: ParallelBranch[];
}

// ============================================================================
// LdGraph — Root Document Model
// ============================================================================

/**
 * Root graph model for a ladder diagram document.
 *
 * Contains all visual elements (nodes, edges) and the logical
 * rung structure. This is the serializable unit that GLSP sends
 * between server and client.
 *
 * In GLSP, this is a `graph:ld` root element.
 */
export interface LdGraph {
  /** Document identifier (UUID v4) — persisted with the diagram file */
  id: string;
  /** All nodes in the graph (contacts, coils, rails, FB placeholders) */
  nodes: BaseNode[];
  /** All edges in the graph (wires, power connections) */
  edges: BaseEdge[];
  /** Rungs defining the logical structure, evaluated top-to-bottom */
  rungs: Rung[];
}

// ============================================================================
// Parallel Branch
// ============================================================================

/**
 * A parallel branch (OR group) on a rung.
 *
 * The branch hangs off a series element (`anchorId` — the top path of the
 * group). Members are stacked vertically below the anchor at the same
 * column x. In IL the anchor is emitted as LD/AND (its series position)
 * and every member as OR/ORN.
 */
export interface ParallelBranch {
  /** Unique identifier (UUID v4) */
  id: string;
  /** ID of the rung this branch belongs to */
  rungId: string;
  /** ID of the series element the branch hangs off (the top path) */
  anchorId: string;
  /** Member contact IDs, top-to-bottom order (each = one OR path) */
  elementIds: string[];
  /** Column x position — all members share the anchor's column */
  x: number;
}

// ============================================================================

let nextId = 0;

/**
 * Generate a unique element ID.
 *
 * Monotonic counter + random suffix. The suffix guards against collisions
 * with hand-authored ids in loaded .ld files (a fixture rung literally named
 * 'rung-1' collided with the first generated 'rung-1' — React Flow dedupes
 * nodes by id, silently dropping one rung).
 */
export function generateId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${nextId}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Create a contact node with sensible defaults.
 *
 * @param contactType - NO (normally open) or NC (normally closed)
 * @param variableName - IEC 61131-3 variable name, e.g. "X1"
 * @param position - Canvas position (defaults to origin)
 * @returns A fully-formed ContactNode
 */
export function createContact(
  contactType: ContactType,
  variableName: string,
  position?: Point,
): ContactNode {
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
 * Create a comparison box node with sensible defaults.
 *
 * @param operator - EQ/GT/LT/GE/LE
 * @param operandA - Left operand variable name
 * @param operandB - Right operand variable name or literal
 * @param position - Canvas position (defaults to origin)
 * @returns A fully-formed ComparisonNode
 */
export function createComparison(
  operator: ComparisonOperator,
  operandA: string,
  operandB: string,
  position?: Point,
): ComparisonNode {
  return {
    id: generateId('cmp'),
    type: 'node:comparison',
    operator,
    operandA,
    operandB,
    position: position ?? { x: 0, y: 0 },
    size: { width: 80, height: 40 },
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
export function createCoil(
  coilType: CoilType,
  variableName: string,
  position?: Point,
): CoilNode {
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
export function createPowerRail(
  side: PowerRailSide,
  position?: Point,
  height?: number,
): PowerRailNode {
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
export function createFb(
  fbType: string,
  inputPins: Pin[],
  outputPins: Pin[],
  position?: Point,
): FbPlaceholderNode {
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
export function createWire(
  sourceId: string,
  targetId: string,
  routingPoints?: Point[],
): WireConnection {
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
export function createPowerConnection(
  sourceId: string,
  targetId: string,
): PowerConnection {
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
export function createRung(
  rungNumber: number,
  elementIds: string[],
  comment?: string,
): Rung {
  return {
    id: generateId('rung'),
    rungNumber,
    comment,
    elementIds,
  };
}

/**
 * Create a parallel branch structure.
 *
 * @param rungId - ID of the owning rung
 * @param anchorId - ID of the series element the branch hangs off
 * @param x - Column x position of the branch
 * @returns A fully-formed ParallelBranch with no members yet
 */
export function createBranch(rungId: string, anchorId: string, x: number): ParallelBranch {
  return {
    id: generateId('branch'),
    rungId,
    anchorId,
    elementIds: [],
    x,
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
export function createLdGraph(id?: string): LdGraph {
  return {
    id: id ?? generateId('ldgraph'),
    nodes: [],
    edges: [],
    rungs: [],
  };
}
