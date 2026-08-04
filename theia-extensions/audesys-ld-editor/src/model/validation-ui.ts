/**
 * Validation → UI markup mapping (P2, SmartCoding-style).
 *
 * Pure function: maps a `ValidationResult` (flat error message list) onto
 * the elements that should be visually marked in the React Flow view.
 * Kept free of React/React Flow imports so it is directly unit-testable.
 *
 * Recognized error shapes (produced by LdOperationHandler.validate and
 * validateGraph in model/serialization):
 *   - `Rung N: ...`                    → rung-level error (rung number)
 *   - `Empty rung: "id" (rung N) ...`  → rung-level error (id + number)
 *   - `Orphan node: "id" (type: ...)`  → node-level error (node id)
 * Any other message is counted in `total` but not mapped to an element —
 * dangling-edge/branch errors reference ids that no longer exist, so there
 * is nothing left to highlight.
 */
import { ValidationResult } from './serialization';
import { LdGraph } from './model';

export interface ValidationMarkup {
    /** Total error count (all messages, mapped or not). */
    total: number;
    /** Raw error messages (tooltip content). */
    messages: string[];
    /** Rung numbers with at least one error, ascending. */
    rungNumbers: number[];
    /** Rung id → error messages. */
    rungIds: string[];
    /** Rung number → error messages. */
    rungErrors: ReadonlyMap<number, string[]>;
    /** Node ids with at least one error (orphans etc). */
    nodeIds: string[];
    /** Node id → error messages. */
    nodeErrors: ReadonlyMap<string, string[]>;
}

const RUNG_NUMBER_RE = /^Rung (\d+):/;
const EMPTY_RUNG_RE = /^Empty rung: "([^"]+)" \(rung (\d+)\)/;
const QUOTED_ID_RE = /"([^"]+)"/;

export function parseValidationErrors(result: ValidationResult, graph: LdGraph): ValidationMarkup {
    const nodeIdSet = new Set(graph.nodes.map((n) => n.id));
    const rungErrors = new Map<number, string[]>();
    const rungIdSet = new Set<string>();
    const nodeErrors = new Map<string, string[]>();

    for (const msg of result.errors) {
        const rungMatch = RUNG_NUMBER_RE.exec(msg);
        if (rungMatch) {
            appendRung(Number(rungMatch[1]), msg);
            continue;
        }
        const emptyRung = EMPTY_RUNG_RE.exec(msg);
        if (emptyRung) {
            rungIdSet.add(emptyRung[1]);
            appendRung(Number(emptyRung[2]), msg);
            continue;
        }
        // Node-level: any quoted id that actually exists in the graph
        // (orphan nodes, dangling element references).
        const quoted = QUOTED_ID_RE.exec(msg);
        if (quoted && nodeIdSet.has(quoted[1])) {
            const id = quoted[1];
            const list = nodeErrors.get(id) ?? [];
            list.push(msg);
            nodeErrors.set(id, list);
        }
    }

    return {
        total: result.errors.length,
        messages: result.errors,
        rungNumbers: [...rungErrors.keys()].sort((a, b) => a - b),
        rungIds: [...rungIdSet],
        rungErrors,
        nodeIds: [...nodeErrors.keys()],
        nodeErrors,
    };

    function appendRung(rungNumber: number, msg: string): void {
        const list = rungErrors.get(rungNumber) ?? [];
        list.push(msg);
        rungErrors.set(rungNumber, list);
    }
}
