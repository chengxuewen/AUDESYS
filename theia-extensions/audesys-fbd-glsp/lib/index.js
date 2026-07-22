"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.roundTrip = exports.isValid = exports.validateGraph = exports.fromJSON = exports.toJSON = exports.ValidationSeverity = exports.createFbdGraph = exports.createSignalEdge = exports.createFB = exports.createGate = exports.createOutputPin = exports.createInputPin = exports.resetIdCounter = exports.generateId = exports.isSignalEdge = exports.findPin = exports.getOutputPorts = exports.getInputPorts = exports.isFunctionBlockNode = exports.isGateNode = exports.GATE_DEFAULT_SIZES = exports.GateType = exports.PinDirection = void 0;
// Node types
var nodes_1 = require("./gmodel/nodes");
Object.defineProperty(exports, "PinDirection", { enumerable: true, get: function () { return nodes_1.PinDirection; } });
Object.defineProperty(exports, "GateType", { enumerable: true, get: function () { return nodes_1.GateType; } });
Object.defineProperty(exports, "GATE_DEFAULT_SIZES", { enumerable: true, get: function () { return nodes_1.GATE_DEFAULT_SIZES; } });
// Node helpers
var nodes_2 = require("./gmodel/nodes");
Object.defineProperty(exports, "isGateNode", { enumerable: true, get: function () { return nodes_2.isGateNode; } });
Object.defineProperty(exports, "isFunctionBlockNode", { enumerable: true, get: function () { return nodes_2.isFunctionBlockNode; } });
Object.defineProperty(exports, "getInputPorts", { enumerable: true, get: function () { return nodes_2.getInputPorts; } });
Object.defineProperty(exports, "getOutputPorts", { enumerable: true, get: function () { return nodes_2.getOutputPorts; } });
Object.defineProperty(exports, "findPin", { enumerable: true, get: function () { return nodes_2.findPin; } });
// Edge helpers
var edges_1 = require("./gmodel/edges");
Object.defineProperty(exports, "isSignalEdge", { enumerable: true, get: function () { return edges_1.isSignalEdge; } });
var model_1 = require("./gmodel/model");
Object.defineProperty(exports, "generateId", { enumerable: true, get: function () { return model_1.generateId; } });
Object.defineProperty(exports, "resetIdCounter", { enumerable: true, get: function () { return model_1.resetIdCounter; } });
Object.defineProperty(exports, "createInputPin", { enumerable: true, get: function () { return model_1.createInputPin; } });
Object.defineProperty(exports, "createOutputPin", { enumerable: true, get: function () { return model_1.createOutputPin; } });
Object.defineProperty(exports, "createGate", { enumerable: true, get: function () { return model_1.createGate; } });
Object.defineProperty(exports, "createFB", { enumerable: true, get: function () { return model_1.createFB; } });
Object.defineProperty(exports, "createSignalEdge", { enumerable: true, get: function () { return model_1.createSignalEdge; } });
Object.defineProperty(exports, "createFbdGraph", { enumerable: true, get: function () { return model_1.createFbdGraph; } });
// Serialization and validation
var serialization_1 = require("./gmodel/serialization");
Object.defineProperty(exports, "ValidationSeverity", { enumerable: true, get: function () { return serialization_1.ValidationSeverity; } });
var serialization_2 = require("./gmodel/serialization");
Object.defineProperty(exports, "toJSON", { enumerable: true, get: function () { return serialization_2.toJSON; } });
Object.defineProperty(exports, "fromJSON", { enumerable: true, get: function () { return serialization_2.fromJSON; } });
Object.defineProperty(exports, "validateGraph", { enumerable: true, get: function () { return serialization_2.validateGraph; } });
Object.defineProperty(exports, "isValid", { enumerable: true, get: function () { return serialization_2.isValid; } });
Object.defineProperty(exports, "roundTrip", { enumerable: true, get: function () { return serialization_2.roundTrip; } });
//# sourceMappingURL=index.js.map