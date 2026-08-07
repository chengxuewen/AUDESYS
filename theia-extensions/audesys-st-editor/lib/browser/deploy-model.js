"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeHalPrograms = mergeHalPrograms;
exports.failedCompilePaths = failedCompilePaths;
/** Opcodes whose first operand is an absolute instruction-index target. */
const JUMP_OPCODES = new Set(['Jump', 'JumpIf', 'Call']);
/** Rebase a control-flow target operand by `offset` (absolute index → merged index). */
function rebaseTarget(operand, offset) {
    if (!operand || !('Immediate' in operand)) {
        return;
    }
    const value = operand.Immediate;
    // Target is stored as {U32: n} (or {S32: n} for robustness). Rebase in place —
    // the parsed objects are freshly allocated per call, so mutation is safe.
    for (const key of ['U32', 'S32']) {
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
function mergeHalPrograms(programJsons) {
    if (programJsons.length === 0) {
        throw new Error('mergeHalPrograms: no programs to deploy');
    }
    const programs = programJsons.map((json) => JSON.parse(json));
    const merged = {
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
function failedCompilePaths(programs, compile) {
    const failed = [];
    for (const input of programs) {
        try {
            compile(input);
        }
        catch {
            failed.push(input.path);
        }
    }
    return failed;
}
//# sourceMappingURL=deploy-model.js.map