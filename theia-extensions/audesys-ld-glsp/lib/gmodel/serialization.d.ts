/**
 * LD GModel — JSON serialization and validation for ladder diagram models.
 *
 * Supports round-trip serialization (`LdGraph` ↔ JSON string) and
 * structural validation to detect orphan nodes, missing wire connections,
 * and inconsistent rung references.
 */
import { LdGraph } from './model';
/**
 * Serialize an `LdGraph` to a JSON string.
 *
 * Preserves all node and edge types via their string discriminators,
 * ensuring a round-trip through {@link fromJSON} reconstructs the
 * identical graph.
 *
 * @param graph - The ladder diagram graph model
 * @returns Indented JSON string (2-space)
 */
export declare function toJSON(graph: LdGraph): string;
/**
 * Deserialize a JSON string back to an `LdGraph`.
 *
 * Performs a structural parse only; does not validate connectivity.
 * Use {@link validateGraph} after deserialization to check integrity.
 *
 * @param json - A JSON string from {@link toJSON}
 * @returns The reconstructed LdGraph
 * @throws {Error} If the JSON is malformed or not a valid LdGraph shape
 */
export declare function fromJSON(json: string): LdGraph;
/**
 * Result of a graph validation pass.
 */
export interface ValidationResult {
    /** Whether the graph passed all validation checks */
    valid: boolean;
    /** Human-readable error messages (empty when valid) */
    errors: string[];
}
/**
 * Validate the structural integrity of a ladder diagram graph.
 *
 * Checks performed:
 * 1. **Orphan nodes** — every node must be referenced by at least one rung
 * 2. **Rung connectivity** — every rung must have at least one element
 * 3. **Edge references** — every edge must reference existing source and target nodes
 * 4. **Rung element references** — every element ID in a rung must correspond to
 *    an existing node
 *
 * @param graph - The ladder diagram graph to validate
 * @returns A {@link ValidationResult} with any errors found
 */
export declare function validateGraph(graph: LdGraph): ValidationResult;
/**
 * Check whether a graph passes validation.
 *
 * Convenience wrapper around {@link validateGraph}.
 *
 * @returns `true` if the graph has no structural errors
 */
export declare function isValid(graph: LdGraph): boolean;
/**
 * Verify that serialization round-trip preserves graph identity.
 *
 * Serializes the graph to JSON and deserializes it back, then compares
 * key structural properties (node count, edge count, rung count, IDs).
 * Does NOT perform deep equality — use {@link validateGraph} for that.
 *
 * @returns `true` if the round-tripped graph has the same structural counts
 */
export declare function roundTrip(graph: LdGraph): boolean;
//# sourceMappingURL=serialization.d.ts.map