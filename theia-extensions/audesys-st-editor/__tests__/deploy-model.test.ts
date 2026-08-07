/**
 * A5 — Deploy merge pure-logic tests.
 *
 * Verifies `mergeHalPrograms` concatenates multiple POU HalProgram JSON
 * documents and rebases every absolute control-flow target (Jump/JumpIf/Call
 * immediates and function_table entry_points) by the offset of the preceding
 * programs' instruction streams.
 */
import { describe, expect, test } from 'vitest';
import { mergeHalPrograms } from '../src/browser/deploy-model';

/** Minimal HalProgram JSON with the given instruction stream. */
function program(name: string, instructions: unknown[], signals: unknown[] = [], functionTable: unknown[] = []): string {
    return JSON.stringify({ name, signals, channels: [], instructions, function_table: functionTable });
}

const load = (reg: number, value: Record<string, number>) => ({ opcode: 'Load', operands: [{ Register: reg }, { Immediate: value }] });
const jump = (target: number) => ({ opcode: 'Jump', operands: [{ Immediate: { U32: target } }] });
const call = (target: number) => ({ opcode: 'Call', operands: [{ Immediate: { U32: target } }] });
const halt = () => ({ opcode: 'Halt', operands: [] });

describe('mergeHalPrograms', () => {
    test('concatenates instructions and rebases jump targets of later programs', () => {
        // Program A: [Load, Halt] (2 instructions). Program B has a Jump to its own
        // index 1, which must become 2 + 1 = 3 after A is prepended.
        const a = program('motor', [load(0, { S32: 1 }), halt()]);
        const b = program('valve', [jump(1), load(1, { S32: 2 }), halt()]);

        const merged = JSON.parse(mergeHalPrograms([a, b]));
        expect(merged.name).toBe('motor');
        expect(merged.instructions).toHaveLength(5);
        expect(merged.instructions[2]).toEqual(jump(3)); // rebased target
    });

    test('rebases Call targets and function_table entry points', () => {
        const a = program('p1', [load(0, { S32: 0 }), halt()]); // 2 instructions
        const b = program(
            'p2',
            [call(0), halt(), load(1, { S32: 9 }), { opcode: 'Ret', operands: [] }],
            [],
            [{ name: 'init', entry_point: 2, reg_count: 1 }],
        );

        const merged = JSON.parse(mergeHalPrograms([a, b]));
        // p2 body starts at offset 2. Call(0) → 2, fn entry_point 2 → 4.
        expect(merged.instructions[2]).toEqual(call(2));
        expect(merged.function_table).toEqual([{ name: 'init', entry_point: 4, reg_count: 1 }]);
    });

    test('merges signals and channels across programs', () => {
        const a = program('p1', [halt()], [{ hal_signal_name: 'sensor.a', program_var: 'a', direction: 'Read', hal_pin_type: 'S32' }]);
        const b = program('p2', [halt()], [{ hal_signal_name: 'sensor.b', program_var: 'b', direction: 'Write', hal_pin_type: 'S32' }]);

        const merged = JSON.parse(mergeHalPrograms([a, b]));
        expect(merged.signals).toHaveLength(2);
        expect(merged.signals[1].hal_signal_name).toBe('sensor.b');
    });

    test('single program passes through structurally', () => {
        const a = program('only', [load(0, { S32: 5 }), halt()]);
        const merged = JSON.parse(mergeHalPrograms([a]));
        expect(merged.name).toBe('only');
        expect(merged.instructions).toHaveLength(2);
    });

    test('throws on empty input', () => {
        expect(() => mergeHalPrograms([])).toThrow(/no programs/);
    });

    test('throws on malformed JSON', () => {
        expect(() => mergeHalPrograms(['not json'])).toThrow();
    });
});