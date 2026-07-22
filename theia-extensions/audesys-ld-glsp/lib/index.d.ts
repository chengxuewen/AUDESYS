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
export type { Point, Dimension } from './gmodel/nodes';
export { ContactType, CoilType, PowerRailSide, } from './gmodel/nodes';
export type { BaseNode, Pin, ContactNode, CoilNode, PowerRailNode, FbPlaceholderNode, } from './gmodel/nodes';
export type { BaseEdge, WireConnection, PowerConnection, } from './gmodel/edges';
export type { Rung, LdGraph } from './gmodel/model';
export { generateId, createContact, createCoil, createPowerRail, createFb, createWire, createPowerConnection, createRung, createLdGraph, } from './gmodel/model';
export type { ValidationResult } from './gmodel/serialization';
export { toJSON, fromJSON, validateGraph, isValid, roundTrip, } from './gmodel/serialization';
//# sourceMappingURL=index.d.ts.map