/**
 * FBD GModel — Graph model and factory functions for IEC 61131-3 Function Block Diagram.
 *
 * The `FbdGraph` is the root document model. It contains all nodes and
 * edges that together form a complete function block diagram. Unlike LD,
 * FBD has no rungs — it is a free-form directed graph of gates and function
 * blocks connected by signal wires.
 *
 * Factory functions provide a convenient API for creating fully-formed
 * model elements with sensible defaults.
 */

import {
  BaseNode,
  GateNode,
  GateType,
  FunctionBlockNode,
  Pin,
  PinDirection,
  Point,
  Dimension,
  GATE_DEFAULT_SIZES,
} from './nodes';
import { BaseEdge, SignalEdge } from './edges';

// ============================================================================
// FbdGraph — Root Document Model
// ============================================================================

/**
 * Root graph model for a function block diagram document.
 *
 * Contains all visual elements (gate nodes, function block nodes, signal edges).
 * This is the serializable unit that GLSP sends between server and client.
 *
 * In GLSP, this is a `graph:fbd` root element.
 */
export interface FbdGraph {
  /** Document identifier (UUID v4) — persisted with the diagram file */
  id: string;
  /** All nodes in the graph (gates, function blocks) */
  nodes: BaseNode[];
  /** All edges in the graph (signal wires) */
  edges: BaseEdge[];
}

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
export function generateId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

/**
 * Reset the ID counter. Useful for deterministic tests.
 */
export function resetIdCounter(): void {
  nextId = 0;
}

// ============================================================================
// Pin Factory
// ============================================================================

/**
 * Create an input pin with default position at left edge of the block.
 *
 * @param name - Pin identifier (e.g. "IN1", "EN")
 * @param dataType - IEC 61131-3 data type (e.g. "BOOL")
 * @param index - 0-based index among input pins (used for Y positioning)
 * @param totalPins - Total number of pins on this side (used for spacing)
 * @returns A fully-formed input Pin
 */
export function createInputPin(
  name: string,
  dataType: string,
  index: number,
  totalPins: number,
): Pin {
  const spacing = 24;
  const startY = spacing * (totalPins - 1) / 2;
  return {
    name,
    dataType,
    direction: PinDirection.Input,
    position: { x: 0, y: index * spacing - startY },
  };
}

/**
 * Create an output pin with default position at right edge of the block.
 *
 * @param name - Pin identifier (e.g. "OUT", "ENO")
 * @param dataType - IEC 61131-3 data type (e.g. "BOOL")
 * @param blockWidth - Width of the parent block (used for X positioning)
 * @param index - 0-based index among output pins (used for Y positioning)
 * @param totalPins - Total number of pins on this side (used for spacing)
 * @returns A fully-formed output Pin
 */
export function createOutputPin(
  name: string,
  dataType: string,
  blockWidth: number,
  index: number,
  totalPins: number,
): Pin {
  const spacing = 24;
  const startY = spacing * (totalPins - 1) / 2;
  return {
    name,
    dataType,
    direction: PinDirection.Output,
    position: { x: blockWidth, y: index * spacing - startY },
  };
}

// ============================================================================
// Gate Factory
// ============================================================================

/**
 * Create a gate node with sensible defaults.
 *
 * Automatically generates the correct input/output pins based on gate type:
 * - AND/OR/XOR: 2 input pins, 1 output pin
 * - NOT: 1 input pin, 1 output pin
 * - MUX: SEL + 2 data input pins, 1 output pin
 *
 * @param gateType - Logic gate type (AND, OR, XOR, NOT, MUX)
 * @param position - Canvas position (defaults to origin)
 * @returns A fully-formed GateNode
 */
export function createGate(
  gateType: GateType,
  position?: Point,
): GateNode {
  const size = GATE_DEFAULT_SIZES[gateType];
  const inputNames = getDefaultInputPinNames(gateType);
  const inputPorts: Pin[] = inputNames.map((name, i) =>
    createInputPin(name, 'BOOL', i, inputNames.length),
  );
  const outputPorts: Pin[] = [
    createOutputPin('OUT', 'BOOL', size.width, 0, 1),
  ];

  return {
    id: generateId('gate'),
    type: 'node:gate',
    gateType,
    inputPorts,
    outputPorts,
    position: position ?? { x: 0, y: 0 },
    size,
  };
}

/**
 * Get the default input pin names for a gate type.
 */
function getDefaultInputPinNames(gateType: GateType): string[] {
  switch (gateType) {
    case GateType.NOT:
      return ['IN'];
    case GateType.MUX:
      return ['SEL', 'IN0', 'IN1'];
    case GateType.AND:
    case GateType.OR:
    case GateType.XOR:
    default:
      return ['IN1', 'IN2'];
  }
}

// ============================================================================
// Function Block Factory
// ============================================================================

/**
 * Create a function block node.
 *
 * @param fbType - FB type name (e.g. "TON", "CTU", "ADD", "MOVE")
 * @param inputPins - Array of input pins
 * @param outputPins - Array of output pins
 * @param position - Canvas position (defaults to origin)
 * @returns A fully-formed FunctionBlockNode
 */
export function createFB(
  fbType: string,
  inputPins: Pin[],
  outputPins: Pin[],
  position?: Point,
): FunctionBlockNode {
  const pinCount = Math.max(inputPins.length, outputPins.length);
  const height = Math.max(60, pinCount * 28 + 16);

  return {
    id: generateId('fb'),
    type: 'node:fb',
    fbType,
    inputPorts: inputPins,
    outputPorts: outputPins,
    position: position ?? { x: 0, y: 0 },
    size: { width: 120, height },
  };
}

// ============================================================================
// Edge Factory
// ============================================================================

/**
 * Create a signal edge between an output pin and an input pin.
 *
 * @param sourceId - ID of the source node
 * @param sourcePortName - Name of the output pin on the source node
 * @param targetId - ID of the target node
 * @param targetPortName - Name of the input pin on the target node
 * @param routingPoints - Optional manual routing waypoints
 * @returns A fully-formed SignalEdge
 */
export function createSignalEdge(
  sourceId: string,
  sourcePortName: string,
  targetId: string,
  targetPortName: string,
  routingPoints?: Point[],
): SignalEdge {
  return {
    id: generateId('signal'),
    type: 'edge:signal',
    sourceId,
    sourcePortName,
    targetId,
    targetPortName,
    routingPoints,
  };
}

// ============================================================================
// Graph Factory
// ============================================================================

/**
 * Create an empty function block diagram graph.
 *
 * @param id - Optional graph ID (auto-generated if omitted)
 * @returns An empty FbdGraph
 */
export function createFbdGraph(id?: string): FbdGraph {
  return {
    id: id ?? generateId('fbdgraph'),
    nodes: [],
    edges: [],
  };
}
