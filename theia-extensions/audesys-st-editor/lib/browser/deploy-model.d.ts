/**
 * A5 — pure deploy logic: merge multiple POU HalProgram JSON documents into a
 * single deployable HalProgram. Zero @theia dependency so it can be unit-tested
 * with vitest without pulling in a DOM.
 *
 * Each POU file compiles to its own HalProgram (a full instruction stream that
 * ends in Halt plus its own function table). The Controller's `load_program`
 * (IPC 0x07) accepts ONE HalProgram, so project deploy merges them:
 *
 *   - instructions are concatenated in order;
 *   - every control-flow target (Jump / JumpIf / Call immediate, and every
 *     function_table entry_point) is absolute instruction INDEX, so all targets
 *     in programs after the first are rebased by the preceding instructions' length.
 *
 * The JSON shape matches exactly what `bridge.json_to_bincode` deserializes into
 * `audesys_hal_ir::program::HalProgram` (serde). Operands are externally-tagged
 * enums: `{"Register": n}`, `{"Immediate": {"U32": n}}`, `{"SignalName": "x"}`.
 */
import { CompileInput } from '../common/st-compile-protocol';
/** One instruction operand — preserved verbatim from the compiler JSON. */
export type HalOperand = {
    Register: number;
} | {
    Immediate: Record<string, number>;
} | {
    SignalName: string;
};
/** One VM instruction in compiler JSON form. */
export interface HalInstruction {
    opcode: string;
    operands: HalOperand[];
}
/** Function-table entry: name → absolute instruction index. */
export interface HalFunctionEntry {
    name: string;
    entry_point: number;
    reg_count: number;
}
/** A compiled HalProgram in its JSON form (subset of the Rust struct). */
export interface HalProgram {
    name: string;
    signals: unknown[];
    channels: unknown[];
    instructions: HalInstruction[];
    function_table: HalFunctionEntry[];
}
/**
 * Merge multiple POU HalProgram JSON strings into a single deployable
 * HalProgram JSON by concatenating their streams and rebasing every absolute
 * control-flow target. Throws when the input is empty or malformed.
 */
export declare function mergeHalPrograms(programJsons: readonly string[]): string;
/** Count of POU files that failed to compile, for the deploy error message. */
export declare function failedCompilePaths(programs: readonly CompileInput[], compile: (input: CompileInput) => string): string[];
//# sourceMappingURL=deploy-model.d.ts.map