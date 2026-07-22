/**
 * FBD GModel — JSON serialization and validation for function block diagram models.
 *
 * Supports round-trip serialization (`FbdGraph` ↔ JSON string) and
 * structural validation to detect feedback loops (via DFS), type
 * mismatches (BOOL→INT connection), dangling ports, and orphan nodes.
 */
import { FbdGraph } from './model';
/**
 * Serialize an `FbdGraph` to a JSON string.
 *
 * Preserves all node and edge types via their string discriminators,
 * ensuring a round-trip through {@link fromJSON} reconstructs the
 * identical graph.
 *
 * @param graph - The function block diagram graph model
 * @returns Indented JSON string (2-space)
 */
export declare function toJSON(graph: FbdGraph): string;
/**
 * Deserialize a JSON string back to an `FbdGraph`.
 *
 * Performs a structural parse only; does not validate connectivity.
 * Use {@link validateGraph} after deserialization to check integrity.
 *
 * @param json - A JSON string from {@link toJSON}
 * @returns The reconstructed FbdGraph
 * @throws {Error} If the JSON is malformed or not a valid FbdGraph shape
 */
export declare function fromJSON(json: string): FbdGraph;
/** Severity level for validation findings. */
export declare enum ValidationSeverity {
    /** Critical error — graph is structurally broken */
    Error = "Error",
    /** Warning — graph may produce unexpected behaviour */
    Warning = "Warning"
}
/** A single validation finding. */
export interface ValidationFinding {
    /** Severity of the finding */
    severity: ValidationSeverity;
    /** Human-readable description of the issue */
    message: string;
}
/**
 * Result of a graph validation pass.
 */
export interface ValidationResult {
    /** Whether the graph passed all error-level checks */
    valid: boolean;
    /** All findings (errors and warnings) */
    findings: ValidationFinding[];
}
/**
 * Validate the structural integrity of a function block diagram graph.
 *
 * Checks performed:
 * 1. **Dangling edge references** — every edge must reference existing source and target nodes
 * 2. **Dangling port references** — every edge's sourcePortName/targetPortName must exist
 * 3. **Pin direction rules** — source pin must be Output (or Bidi), target pin must be Input (or Bidi)
 * 4. **Type mismatches** — warns on BOOL→INT, INT→REAL connections that may lose precision
 * 5. **Feedback loop detection** — DFS for cycles (critical: infinite loop risk)
 * 6. **Disconnected nodes** — nodes with no incoming or outgoing edges
 *
 * @param graph - The function block diagram graph to validate
 * @returns A {@link ValidationResult} with findings
 */
export declare function validateGraph(graph: FbdGraph): ValidationResult;
/**
 * Check whether a graph passes validation (no errors).
 *
 * Convenience wrapper around {@link validateGraph}.
 *
 * @returns `true` if the graph has no error-level findings
 */
export declare function isValid(graph: FbdGraph): boolean;
/**
 * Verify that serialization round-trip preserves graph identity.
 *
 * Serializes the graph to JSON and deserializes it back, then compares
 * key structural properties (node count, edge count, ID).
 * Does NOT perform deep equality — use {@link validateGraph} for that.
 *
 * @returns `true` if the round-tripped graph has the same structural counts
 */
export declare function roundTrip(graph: FbdGraph): boolean;
//# sourceMappingURL=serialization.d.ts.map