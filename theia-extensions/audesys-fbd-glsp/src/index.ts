/**
 * AUDESYS FBD GLSP — GModel type definitions for IEC 61131-3 Function Block Diagram.
 *
 * This package provides the graph model (GModel) types used by the
 * GLSP-based function block diagram editor. It defines:
 *
 * - **Nodes**: GateNode (AND/OR/XOR/NOT/MUX), FunctionBlockNode
 * - **Edges**: SignalEdge with pin-level port references
 * - **Model**: FbdGraph
 * - **Serialization**: JSON round-trip + structural validation + cycle detection
 * - **Factories**: Convenient creation functions with sensible defaults
 *
 * These types follow the GLSP GModel convention (`node:<kind>`,
 * `edge:<kind>`) and are compatible with `@eclipse-glsp/client` base types
 * when that dependency is added in later phases.
 *
 * @packageDocumentation
 */

// Geometry
export type { Point, Dimension } from './gmodel/nodes';

// Node types
export {
  PinDirection,
  GateType,
  GATE_DEFAULT_SIZES,
} from './gmodel/nodes';
export type {
  BaseNode,
  Pin,
  GateNode,
  FunctionBlockNode,
} from './gmodel/nodes';

// Node helpers
export {
  isGateNode,
  isFunctionBlockNode,
  getInputPorts,
  getOutputPorts,
  findPin,
} from './gmodel/nodes';

// Edge types
export type {
  BaseEdge,
  SignalEdge,
} from './gmodel/edges';

// Edge helpers
export { isSignalEdge } from './gmodel/edges';

// Model and factories
export type { FbdGraph } from './gmodel/model';
export {
  generateId,
  resetIdCounter,
  createInputPin,
  createOutputPin,
  createGate,
  createFB,
  createSignalEdge,
  createFbdGraph,
} from './gmodel/model';

// Serialization and validation
export {
  ValidationSeverity,
} from './gmodel/serialization';
export type { ValidationFinding, ValidationResult } from './gmodel/serialization';
export {
  toJSON,
  fromJSON,
  validateGraph,
  isValid,
  roundTrip,
} from './gmodel/serialization';
