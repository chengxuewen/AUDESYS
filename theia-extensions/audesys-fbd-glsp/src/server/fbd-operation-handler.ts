/**
 * FBD Operation Handler — thin dispatch layer for Function Block Diagram GLSP operations.
 *
 * Ponytail: one class, one file. ~60% reused from LD pattern.
 */

import {
  FbdGraph,
  createGate,
  createFB,
  createSignalEdge,
  createInputPin,
  createOutputPin,
} from '../gmodel/model';
import {
  BaseNode,
  GateType,
  PinDirection,
  Point,
  findPin,
  isGateNode,
  isFunctionBlockNode,
} from '../gmodel/nodes';
import { validateGraph, ValidationResult, ValidationSeverity } from '../gmodel/serialization';
import { convertGraphToIl } from './fbd-compile';
import { getFbDef } from './fbd-fb-registry';

// ============================================================================
// Operation Parameter Types
// ============================================================================

export interface CreateGateParams { gateType: GateType; position: Point; }
export interface CreateFunctionBlockParams { fbType: string; position: Point; }
export interface DeleteElementParams { elementId: string; }
export interface ConnectPinsParams {
  sourceNodeId: string; sourcePortName: string;
  targetNodeId: string; targetPortName: string;
}
export interface DisconnectPinParams { nodeId: string; portName: string; }
export interface MoveElementParams { elementId: string; newPosition: Point; }
export interface ChangeGateTypeParams { elementId: string; newGateType: GateType; }
export interface ChangeFbTypeParams { fbId: string; newFbType: string; }

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
  programJson: string;
  diagnostics: CompileDiagnostic[];
}

// ============================================================================
// Compile Wrapper (ponytail: same pattern as LD handler)
// ============================================================================

type CompileFn = (source: string) => string;

function defaultCompile(source: string): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@audesys/theia-bridge').compileFbd(source);
}

function parseCompileOutput(raw: string): CompileResult {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return {
        success: false, programJson: '',
        diagnostics: parsed.map((d: Record<string, unknown>, i: number) => ({
          severity: (d.severity as 'error' | 'warning') || 'error',
          line: d.line as number | undefined,
          message: (d.message as string) || String(d),
          code: (d.code as string) || `E${String(i).padStart(3, '0')}`,
        })),
      };
    }
    if (typeof parsed === 'object' && parsed !== null && 'instructions' in parsed) {
      return { success: true, programJson: raw, diagnostics: [] };
    }
    return { success: false, programJson: '', diagnostics: [{ severity: 'error', message: 'Unknown compile output', code: 'E999' }] };
  } catch {
    return { success: false, programJson: '', diagnostics: [{ severity: 'error', message: raw, code: 'E998' }] };
  }
}

// ============================================================================
// Snapping
// ============================================================================

const GRID_X = 20;
const GRID_Y = 20;

function snapToGrid(p: Point): Point {
  return { x: Math.round(p.x / GRID_X) * GRID_X, y: Math.round(p.y / GRID_Y) * GRID_Y };
}

// ============================================================================
// FB Factory Helper
// ============================================================================

function createFbWithPins(fbType: string, position: Point) {
  const def = getFbDef(fbType);
  if (def) {
    const inputs = def.inputs.map((d, i) => createInputPin(d.name, d.dataType, i, def.inputs.length));
    const w = Math.max(120, fbType.length * 8 + 40);
    const outputs = def.outputs.map((d, i) => createOutputPin(d.name, d.dataType, w, i, def.outputs.length));
    return createFB(fbType, inputs, outputs, position);
  }
  // ponytail: unknown type → generic 2-in, 2-out
  return createFB(
    fbType,
    [createInputPin('IN1', 'BOOL', 0, 2), createInputPin('IN2', 'BOOL', 1, 2)],
    [createOutputPin('Q1', 'BOOL', 120, 0, 2), createOutputPin('Q2', 'BOOL', 120, 1, 2)],
    position,
  );
}

// ============================================================================
// FbdOperationHandler
// ============================================================================

export class FbdOperationHandler {
  private compileFn: CompileFn;

  constructor(compileFn?: CompileFn) {
    this.compileFn = compileFn ?? defaultCompile;
  }

  /** Create a gate node with default pins. */
  createGate(graph: FbdGraph, params: CreateGateParams): FbdGraph {
    const gate = createGate(params.gateType, snapToGrid(params.position));
    const next = cloneGraph(graph);
    next.nodes.push(gate);
    return next;
  }

  /** Create a function block with type-specific pins. */
  createFunctionBlock(graph: FbdGraph, params: CreateFunctionBlockParams): FbdGraph {
    const fb = createFbWithPins(params.fbType, snapToGrid(params.position));
    const next = cloneGraph(graph);
    next.nodes.push(fb);
    return next;
  }

  /** Delete a node and all connected edges. */
  deleteElement(graph: FbdGraph, params: DeleteElementParams): FbdGraph {
    if (!findNode(graph, params.elementId)) throw new ValidationError(`Element not found: ${params.elementId}`);
    const next = cloneGraph(graph);
    next.nodes = next.nodes.filter((n) => n.id !== params.elementId);
    next.edges = next.edges.filter((e) => e.sourceId !== params.elementId && e.targetId !== params.elementId);
    return next;
  }

  /** Connect output pin → input pin. Validates direction + type. */
  connectPins(graph: FbdGraph, params: ConnectPinsParams): FbdGraph {
    const srcNode = validatePin(graph, params.sourceNodeId, params.sourcePortName, 'source');
    const tgtNode = validatePin(graph, params.targetNodeId, params.targetPortName, 'target');
    const srcPin = findPin(srcNode, params.sourcePortName)!;
    const tgtPin = findPin(tgtNode, params.targetPortName)!;

    if (srcPin.direction !== PinDirection.Output && srcPin.direction !== PinDirection.Bidi) {
      throw new ValidationError(`Source pin "${params.sourcePortName}" is ${srcPin.direction}, must be Output/Bidi`);
    }
    if (tgtPin.direction !== PinDirection.Input && tgtPin.direction !== PinDirection.Bidi) {
      throw new ValidationError(`Target pin "${params.targetPortName}" is ${tgtPin.direction}, must be Input/Bidi`);
    }
    if (srcPin.dataType !== tgtPin.dataType) {
      const ok = srcPin.dataType === 'INT' && tgtPin.dataType === 'REAL';
      if (!ok) throw new ValidationError(`Type mismatch: ${srcPin.dataType} → ${tgtPin.dataType}`);
    }
    // Duplicate check — idempotent
    const dup = graph.edges.find(
      (e) => e.sourceId === params.sourceNodeId && e.sourcePortName === params.sourcePortName &&
              e.targetId === params.targetNodeId && e.targetPortName === params.targetPortName,
    );
    if (dup) return graph;

    const edge = createSignalEdge(params.sourceNodeId, params.sourcePortName, params.targetNodeId, params.targetPortName);
    const next = cloneGraph(graph);
    next.edges.push(edge);
    return next;
  }

  /** Disconnect all edges on a node's port. */
  disconnectPin(graph: FbdGraph, params: DisconnectPinParams): FbdGraph {
    if (!findNode(graph, params.nodeId)) throw new ValidationError(`Node not found: ${params.nodeId}`);
    const next = cloneGraph(graph);
    next.edges = next.edges.filter(
      (e) => !((e.sourceId === params.nodeId && e.sourcePortName === params.portName) ||
               (e.targetId === params.nodeId && e.targetPortName === params.portName)),
    );
    return next;
  }

  /** Move node to new position (snap to grid). */
  moveElement(graph: FbdGraph, params: MoveElementParams): FbdGraph {
    if (!findNode(graph, params.elementId)) throw new ValidationError(`Element not found: ${params.elementId}`);
    const next = cloneGraph(graph);
    const idx = next.nodes.findIndex((n) => n.id === params.elementId);
    if (idx >= 0) next.nodes[idx] = { ...next.nodes[idx], position: snapToGrid(params.newPosition) };
    return next;
  }

  /** Change gate type, regenerating pins. Preserves element ID. */
  changeGateType(graph: FbdGraph, params: ChangeGateTypeParams): FbdGraph {
    const node = findNode(graph, params.elementId);
    if (!node || !isGateNode(node)) throw new ValidationError(`Not a gate: ${params.elementId}`);
    if (node.gateType === params.newGateType) return graph;

    const newGate = createGate(params.newGateType, node.position);
    const next = cloneGraph(graph);
    const idx = next.nodes.findIndex((n) => n.id === params.elementId);
    if (idx >= 0) next.nodes[idx] = { ...newGate, id: params.elementId };
    return next;
  }

  /** Change FB type, regenerating pins. Removes edges to obsolete pins. */
  changeFbType(graph: FbdGraph, params: ChangeFbTypeParams): FbdGraph {
    const node = findNode(graph, params.fbId);
    if (!node || !isFunctionBlockNode(node)) throw new ValidationError(`Not an FB: ${params.fbId}`);
    if (node.fbType === params.newFbType) return graph;

    const newFb = createFbWithPins(params.newFbType, node.position);
    const next = cloneGraph(graph);
    const idx = next.nodes.findIndex((n) => n.id === params.fbId);
    if (idx >= 0) next.nodes[idx] = { ...newFb, id: params.fbId };

    const validPins = new Set([...newFb.inputPorts, ...newFb.outputPorts].map((p) => p.name));
    next.edges = next.edges.filter((e) => {
      if (e.sourceId === params.fbId && !validPins.has(e.sourcePortName)) return false;
      if (e.targetId === params.fbId && !validPins.has(e.targetPortName)) return false;
      return true;
    });
    return next;
  }

  /** Validate: structural + unconnected output pin warnings. */
  validate(graph: FbdGraph): ValidationResult {
    const result = validateGraph(graph);
    for (const node of graph.nodes) {
      const outputs = isGateNode(node) ? node.outputPorts : isFunctionBlockNode(node) ? node.outputPorts : [];
      for (const pin of outputs) {
        const hasEdge = graph.edges.some((e) => e.sourceId === node.id && e.sourcePortName === pin.name);
        if (!hasEdge) result.findings.push({ severity: ValidationSeverity.Warning, message: `Unconnected output: "${pin.name}" on ${node.type} "${node.id}"` });
      }
    }
    return { valid: result.valid, findings: result.findings };
  }

  /** Compile: validate → FBD→IL → napi-rs compileFbd → HalProgram. */
  compile(graph: FbdGraph): CompileResult {
    const validation = this.validate(graph);
    if (!validation.valid) {
      const errors = validation.findings.filter((f) => f.severity === 'Error');
      return {
        success: false, programJson: '',
        diagnostics: errors.map((f, i) => ({ severity: 'error', message: f.message, code: `V${String(i + 1).padStart(3, '0')}` })),
      };
    }
    try {
      const ilResult = convertGraphToIl(graph);
      return parseCompileOutput(this.compileFn(ilResult.ilText));
    } catch (err) {
      return {
        success: false, programJson: '',
        diagnostics: [{ severity: 'error', message: err instanceof Error ? err.message : String(err), code: 'E999' }],
      };
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

class ValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'ValidationError'; }
}

function cloneGraph(graph: FbdGraph): FbdGraph {
  return JSON.parse(JSON.stringify(graph));
}

function findNode(graph: FbdGraph, nodeId: string): BaseNode | undefined {
  return graph.nodes.find((n) => n.id === nodeId);
}

function validatePin(graph: FbdGraph, nodeId: string, portName: string, role: string): BaseNode {
  const node = findNode(graph, nodeId);
  if (!node) throw new ValidationError(`${role} node not found: ${nodeId}`);
  const pin = findPin(node, portName);
  if (!pin) throw new ValidationError(`${role} port "${portName}" not found on ${node.type} "${nodeId}"`);
  return node;
}
