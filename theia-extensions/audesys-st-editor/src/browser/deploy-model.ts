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
export type HalOperand =
    | { Register: number }
    | { Immediate: Record<string, number> }
    | { SignalName: string };

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

/** Opcodes whose first operand is an absolute instruction-index target. */
const JUMP_OPCODES = new Set(['Jump', 'JumpIf', 'Call']);

/** Rebase a control-flow target operand by `offset` (absolute index → merged index). */
function rebaseTarget(operand: HalOperand | undefined, offset: number): void {
    if (!operand || !('Immediate' in operand)) {
        return;
    }
    const value = operand.Immediate;
    // Target is stored as {U32: n} (or {S32: n} for robustness). Rebase in place —
    // the parsed objects are freshly allocated per call, so mutation is safe.
    for (const key of ['U32', 'S32'] as const) {
        if (typeof value[key] === 'number') {
            value[key] = value[key] + offset;
        }
    }
}

/**
 * Merge multiple POU HalProgram JSON strings into a single deployable
 * HalProgram JSON by concatenating their streams and rebasing every absolute
 * control-flow target. Throws when the input is empty or malformed.
 */
export function mergeHalPrograms(programJsons: readonly string[]): string {
    if (programJsons.length === 0) {
        throw new Error('mergeHalPrograms: no programs to deploy');
    }
    const programs = programJsons.map((json) => JSON.parse(json) as HalProgram);

    const merged: HalProgram = {
        name: programs[0].name,
        signals: [],
        channels: [],
        instructions: [],
        function_table: [],
    };

    let offset = 0;
    for (const prog of programs) {
        for (const inst of prog.instructions) {
            if (JUMP_OPCODES.has(inst.opcode)) {
                rebaseTarget(inst.operands[0], offset);
            }
        }
        for (const fn of prog.function_table) {
            fn.entry_point += offset;
        }
        merged.signals.push(...prog.signals);
        merged.channels.push(...prog.channels);
        merged.instructions.push(...prog.instructions);
        merged.function_table.push(...prog.function_table);
        offset += prog.instructions.length;
    }

    return JSON.stringify(merged);
}

/** Count of POU files that failed to compile, for the deploy error message. */
export function failedCompilePaths(programs: readonly CompileInput[], compile: (input: CompileInput) => string): string[] {
    const failed: string[] = [];
    for (const input of programs) {
        try {
            compile(input);
        } catch {
            failed.push(input.path);
        }
    }
    return failed;
}