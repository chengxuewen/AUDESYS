"use strict";
/**
 * FB Pin Registry — default input/output pin definitions for known IEC 61131-3
 * standard function block types.
 *
 * ponytail: compact registry, not a class.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFbDef = getFbDef;
const nodes_1 = require("../gmodel/nodes");
const I = nodes_1.PinDirection.Input;
const O = nodes_1.PinDirection.Output;
const REGISTRY = {
    // Timers
    TON: { inputs: [['IN', 'BOOL', I], ['PT', 'TIME', I]], outputs: [['Q', 'BOOL', O], ['ET', 'TIME', O]] },
    TOF: { inputs: [['IN', 'BOOL', I], ['PT', 'TIME', I]], outputs: [['Q', 'BOOL', O], ['ET', 'TIME', O]] },
    TP: { inputs: [['IN', 'BOOL', I], ['PT', 'TIME', I]], outputs: [['Q', 'BOOL', O], ['ET', 'TIME', O]] },
    // Counters
    CTU: { inputs: [['CU', 'BOOL', I], ['R', 'BOOL', I], ['PV', 'INT', I]], outputs: [['Q', 'BOOL', O], ['CV', 'INT', O]] },
    CTD: { inputs: [['CD', 'BOOL', I], ['LD', 'BOOL', I], ['PV', 'INT', I]], outputs: [['Q', 'BOOL', O], ['CV', 'INT', O]] },
    CTUD: { inputs: [['CU', 'BOOL', I], ['CD', 'BOOL', I], ['R', 'BOOL', I], ['LD', 'BOOL', I], ['PV', 'INT', I]],
        outputs: [['QU', 'BOOL', O], ['QD', 'BOOL', O], ['CV', 'INT', O]] },
    // Bistable
    SR: { inputs: [['S1', 'BOOL', I], ['R', 'BOOL', I]], outputs: [['Q1', 'BOOL', O]] },
    RS: { inputs: [['S', 'BOOL', I], ['R1', 'BOOL', I]], outputs: [['Q1', 'BOOL', O]] },
    // Edge detection
    R_TRIG: { inputs: [['CLK', 'BOOL', I]], outputs: [['Q', 'BOOL', O]] },
    F_TRIG: { inputs: [['CLK', 'BOOL', I]], outputs: [['Q', 'BOOL', O]] },
    // Arithmetic
    ADD: { inputs: [['IN1', 'INT', I], ['IN2', 'INT', I]], outputs: [['OUT', 'INT', O]] },
    SUB: { inputs: [['IN1', 'INT', I], ['IN2', 'INT', I]], outputs: [['OUT', 'INT', O]] },
    MUL: { inputs: [['IN1', 'INT', I], ['IN2', 'INT', I]], outputs: [['OUT', 'INT', O]] },
    DIV: { inputs: [['IN1', 'INT', I], ['IN2', 'INT', I]], outputs: [['OUT', 'INT', O]] },
    MOVE: { inputs: [['IN', 'INT', I]], outputs: [['OUT', 'INT', O]] },
    // Comparison
    EQ: { inputs: [['IN1', 'INT', I], ['IN2', 'INT', I]], outputs: [['OUT', 'BOOL', O]] },
    GT: { inputs: [['IN1', 'INT', I], ['IN2', 'INT', I]], outputs: [['OUT', 'BOOL', O]] },
    LT: { inputs: [['IN1', 'INT', I], ['IN2', 'INT', I]], outputs: [['OUT', 'BOOL', O]] },
    GE: { inputs: [['IN1', 'INT', I], ['IN2', 'INT', I]], outputs: [['OUT', 'BOOL', O]] },
    LE: { inputs: [['IN1', 'INT', I], ['IN2', 'INT', I]], outputs: [['OUT', 'BOOL', O]] },
    // Selection
    SEL: { inputs: [['G', 'BOOL', I], ['IN0', 'INT', I], ['IN1', 'INT', I]], outputs: [['OUT', 'INT', O]] },
};
function expand(raw) {
    return {
        inputs: raw.inputs.map(([name, dataType, direction]) => ({ name, dataType, direction })),
        outputs: raw.outputs.map(([name, dataType, direction]) => ({ name, dataType, direction })),
    };
}
/** Get expanded pin definition for a known FB type, or undefined. */
function getFbDef(fbType) {
    const def = REGISTRY[fbType.toUpperCase()];
    return def ? expand(def) : undefined;
}
//# sourceMappingURL=fbd-fb-registry.js.map