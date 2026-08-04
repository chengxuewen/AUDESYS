/**
 * LD FB Catalog — function block type definitions with standard IEC 61131-3 pins.
 *
 * Source of truth for the FB palette (LdCanvas) and `addFb` (LdOperationHandler).
 * Pin positions are relative to the block origin; y offsets are computed from
 * the pin index so handles land on 30px-stacked rows.
 */

import { Pin } from './nodes';

/** IEC 61131-3 function block type names. */
export const FB_TYPES = [
    // Timers
    'TON', 'TOF', 'TP',
    // Counters
    'CTU', 'CTD',
    // Comparison (box form contacts)
    'EQ', 'GT', 'LT', 'GE', 'LE', 'NE',
    // Arithmetic
    'ADD', 'SUB', 'MUL', 'DIV', 'MOD',
] as const;

export type FbType = (typeof FB_TYPES)[number];

/** Pin row height in px (pin vertical spacing). */
const PIN_ROW = 30;

interface FbDefinition {
    /** FB type name */
    type: FbType;
    /** Palette label (also used as tool button title) */
    label: string;
    /** Input pin names in top-to-bottom order (EN prepended automatically) */
    inputs: Array<{ name: string; dataType: string }>;
    /** Output pin names (ENO prepended automatically) */
    outputs: Array<{ name: string; dataType: string }>;
}

const FB_DEFINITIONS: FbDefinition[] = [
    // ── Timers ──────────────────────────────────────────────
    { type: 'TON', label: 'TON', inputs: [{ name: 'IN', dataType: 'BOOL' }, { name: 'PT', dataType: 'TIME' }], outputs: [{ name: 'Q', dataType: 'BOOL' }, { name: 'ET', dataType: 'TIME' }] },
    { type: 'TOF', label: 'TOF', inputs: [{ name: 'IN', dataType: 'BOOL' }, { name: 'PT', dataType: 'TIME' }], outputs: [{ name: 'Q', dataType: 'BOOL' }, { name: 'ET', dataType: 'TIME' }] },
    { type: 'TP', label: 'TP', inputs: [{ name: 'IN', dataType: 'BOOL' }, { name: 'PT', dataType: 'TIME' }], outputs: [{ name: 'Q', dataType: 'BOOL' }, { name: 'ET', dataType: 'TIME' }] },
    // ── Counters ────────────────────────────────────────────
    { type: 'CTU', label: 'CTU', inputs: [{ name: 'CU', dataType: 'BOOL' }, { name: 'R', dataType: 'BOOL' }, { name: 'PV', dataType: 'INT' }], outputs: [{ name: 'Q', dataType: 'BOOL' }, { name: 'CV', dataType: 'INT' }] },
    { type: 'CTD', label: 'CTD', inputs: [{ name: 'CD', dataType: 'BOOL' }, { name: 'LD', dataType: 'BOOL' }, { name: 'PV', dataType: 'INT' }], outputs: [{ name: 'Q', dataType: 'BOOL' }, { name: 'CV', dataType: 'INT' }] },
    // ── Comparison (box form contacts) ──────────────────────
    { type: 'EQ', label: 'EQ', inputs: [{ name: 'IN1', dataType: 'ANY' }, { name: 'IN2', dataType: 'ANY' }], outputs: [{ name: 'Q', dataType: 'BOOL' }] },
    { type: 'GT', label: 'GT', inputs: [{ name: 'IN1', dataType: 'ANY' }, { name: 'IN2', dataType: 'ANY' }], outputs: [{ name: 'Q', dataType: 'BOOL' }] },
    { type: 'LT', label: 'LT', inputs: [{ name: 'IN1', dataType: 'ANY' }, { name: 'IN2', dataType: 'ANY' }], outputs: [{ name: 'Q', dataType: 'BOOL' }] },
    { type: 'GE', label: 'GE', inputs: [{ name: 'IN1', dataType: 'ANY' }, { name: 'IN2', dataType: 'ANY' }], outputs: [{ name: 'Q', dataType: 'BOOL' }] },
    { type: 'LE', label: 'LE', inputs: [{ name: 'IN1', dataType: 'ANY' }, { name: 'IN2', dataType: 'ANY' }], outputs: [{ name: 'Q', dataType: 'BOOL' }] },
    { type: 'NE', label: 'NE', inputs: [{ name: 'IN1', dataType: 'ANY' }, { name: 'IN2', dataType: 'ANY' }], outputs: [{ name: 'Q', dataType: 'BOOL' }] },
    // ── Arithmetic ──────────────────────────────────────────
    { type: 'ADD', label: 'ADD', inputs: [{ name: 'IN1', dataType: 'ANY_NUM' }, { name: 'IN2', dataType: 'ANY_NUM' }, { name: 'IN3', dataType: 'ANY_NUM' }], outputs: [{ name: 'OUT', dataType: 'ANY_NUM' }] },
    { type: 'SUB', label: 'SUB', inputs: [{ name: 'IN1', dataType: 'ANY_NUM' }, { name: 'IN2', dataType: 'ANY_NUM' }], outputs: [{ name: 'OUT', dataType: 'ANY_NUM' }] },
    { type: 'MUL', label: 'MUL', inputs: [{ name: 'IN1', dataType: 'ANY_NUM' }, { name: 'IN2', dataType: 'ANY_NUM' }], outputs: [{ name: 'OUT', dataType: 'ANY_NUM' }] },
    { type: 'DIV', label: 'DIV', inputs: [{ name: 'IN1', dataType: 'ANY_NUM' }, { name: 'IN2', dataType: 'ANY_NUM' }], outputs: [{ name: 'OUT', dataType: 'ANY_NUM' }] },
    { type: 'MOD', label: 'MOD', inputs: [{ name: 'IN1', dataType: 'ANY_NUM' }, { name: 'IN2', dataType: 'ANY_NUM' }], outputs: [{ name: 'OUT', dataType: 'ANY_NUM' }] },
];

/** Block width in px — fixed for all FB types. */
export const FB_WIDTH = 140;

/** Whether a FB type is known to the catalog. */
export function isFbType(value: string): value is FbType {
    return FB_TYPES.includes(value as FbType);
}

/**
 * Resolve input/output pins (including EN/ENO) for a FB type.
 *
 * @returns Pin arrays with positions computed from pin order, or
 *          `null` when the type is not in the catalog.
 */
export function getFbPins(fbType: string): { inputPins: Pin[]; outputPins: Pin[] } | null {
    const def = FB_DEFINITIONS.find((d) => d.type === fbType);
    if (!def) {
        return null;
    }
    const inputPins: Pin[] = [
        { name: 'EN', dataType: 'BOOL', position: { x: 0, y: 0 } },
        ...def.inputs.map((pin, i) => ({
            name: pin.name,
            dataType: pin.dataType,
            position: { x: 0, y: (i + 1) * PIN_ROW },
        })),
    ];
    const outputPins: Pin[] = [
        { name: 'ENO', dataType: 'BOOL', position: { x: FB_WIDTH, y: 0 } },
        ...def.outputs.map((pin, i) => ({
            name: pin.name,
            dataType: pin.dataType,
            position: { x: FB_WIDTH, y: (i + 1) * PIN_ROW },
        })),
    ];
    return { inputPins, outputPins };
}

/**
 * Block height for a FB type (fits all pins + padding).
 */
export function getFbHeight(fbType: string): number {
    const pins = getFbPins(fbType);
    if (!pins) {
        return 80;
    }
    const rows = Math.max(pins.inputPins.length, pins.outputPins.length);
    return rows * PIN_ROW + 10;
}

/** All FB definitions — used by the palette (label per type). */
export function fbPaletteEntries(): Array<{ type: FbType; label: string }> {
    return FB_DEFINITIONS.map((d) => ({ type: d.type, label: d.label }));
}
