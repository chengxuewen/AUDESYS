"use strict";
/**
 * AUDESYS LD GLSP — GModel type definitions for IEC 61131-3 Ladder Diagram.
 *
 * This package provides the graph model (GModel) types used by the
 * GLSP-based ladder diagram editor. It defines:
 *
 * - **Nodes**: ContactNode, CoilNode, PowerRailNode, FbPlaceholderNode
 * - **Edges**: WireConnection, PowerConnection
 * - **Model**: LdGraph, Rung
 * - **Serialization**: JSON round-trip + structural validation
 * - **Factories**: Convenient creation functions with sensible defaults
 *
 * These types follow the GLSP GModel convention (`node:<kind>`,
 * `edge:<kind>`) and are compatible with `@eclipse-glsp/client` base types
 * when that dependency is added in later phases.
 *
 * @packageDocumentation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.roundTrip = exports.isValid = exports.validateGraph = exports.fromJSON = exports.toJSON = exports.createLdGraph = exports.createRung = exports.createPowerConnection = exports.createWire = exports.createFb = exports.createPowerRail = exports.createCoil = exports.createContact = exports.generateId = exports.PowerRailSide = exports.CoilType = exports.ContactType = void 0;
// Node types
var nodes_1 = require("./gmodel/nodes");
Object.defineProperty(exports, "ContactType", { enumerable: true, get: function () { return nodes_1.ContactType; } });
Object.defineProperty(exports, "CoilType", { enumerable: true, get: function () { return nodes_1.CoilType; } });
Object.defineProperty(exports, "PowerRailSide", { enumerable: true, get: function () { return nodes_1.PowerRailSide; } });
var model_1 = require("./gmodel/model");
Object.defineProperty(exports, "generateId", { enumerable: true, get: function () { return model_1.generateId; } });
Object.defineProperty(exports, "createContact", { enumerable: true, get: function () { return model_1.createContact; } });
Object.defineProperty(exports, "createCoil", { enumerable: true, get: function () { return model_1.createCoil; } });
Object.defineProperty(exports, "createPowerRail", { enumerable: true, get: function () { return model_1.createPowerRail; } });
Object.defineProperty(exports, "createFb", { enumerable: true, get: function () { return model_1.createFb; } });
Object.defineProperty(exports, "createWire", { enumerable: true, get: function () { return model_1.createWire; } });
Object.defineProperty(exports, "createPowerConnection", { enumerable: true, get: function () { return model_1.createPowerConnection; } });
Object.defineProperty(exports, "createRung", { enumerable: true, get: function () { return model_1.createRung; } });
Object.defineProperty(exports, "createLdGraph", { enumerable: true, get: function () { return model_1.createLdGraph; } });
var serialization_1 = require("./gmodel/serialization");
Object.defineProperty(exports, "toJSON", { enumerable: true, get: function () { return serialization_1.toJSON; } });
Object.defineProperty(exports, "fromJSON", { enumerable: true, get: function () { return serialization_1.fromJSON; } });
Object.defineProperty(exports, "validateGraph", { enumerable: true, get: function () { return serialization_1.validateGraph; } });
Object.defineProperty(exports, "isValid", { enumerable: true, get: function () { return serialization_1.isValid; } });
Object.defineProperty(exports, "roundTrip", { enumerable: true, get: function () { return serialization_1.roundTrip; } });
//# sourceMappingURL=index.js.map