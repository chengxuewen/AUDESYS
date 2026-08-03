"use strict";
/**
 * IL completion provider — suggests IEC 61131-3 IL instructions.
 *
 * IMPORTANT: Only lists instructions the IL compiler actually supports.
 * Sync with crates/audesys-il-compiler/src/lexer.rs parse_mnemonic().
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IL_CATEGORY_LIST = exports.IL_INSTRUCTION_COUNT = void 0;
exports.getILCompletionItems = getILCompletionItems;
/** Completion item categories for grouping */
const IL_CATEGORIES = {
    'Load/Store': 'Bit loads and stores',
    'Bit Logic': 'Bitwise logic operations',
    'Arithmetic': 'Arithmetic operations',
    'Comparison': 'Comparison operators',
    'Jump': 'Program flow jumps',
    'Call': 'Function block calls',
    'Return': 'Return from function block',
    'Timers': 'Timer function blocks',
    'Counters': 'Counter function blocks',
    'Edge': 'Edge detection function blocks',
    'Flip-Flop': 'Bistable function blocks',
};
/** All compiler-supported IL instructions (33). Sync with lexer.rs parse_mnemonic() */
const IL_COMPLETIONS = [
    // Load/Store
    { label: 'LD', category: 'Load/Store', documentation: 'Load — makes operand equal to current result', insertText: 'LD  ', detail: 'Load' },
    { label: 'LDN', category: 'Load/Store', documentation: 'Load Negated — loads negated value of operand', insertText: 'LDN ', detail: 'Load Negated' },
    { label: 'ST', category: 'Load/Store', documentation: 'Store — stores current result to operand', insertText: 'ST  ', detail: 'Store' },
    { label: 'S', category: 'Load/Store', documentation: 'Set — sets operand to TRUE when CR is 1', insertText: 'S   ', detail: 'Set (coil)' },
    { label: 'R', category: 'Load/Store', documentation: 'Reset — resets operand to FALSE when CR is 1', insertText: 'R   ', detail: 'Reset (coil)' },
    // Bit Logic
    { label: 'AND', category: 'Bit Logic', documentation: 'AND — bitwise AND with current result', insertText: 'AND  ', detail: 'Bitwise AND' },
    { label: 'ANDN', category: 'Bit Logic', documentation: 'AND Negated — AND with negated operand', insertText: 'ANDN ', detail: 'Bitwise AND Negated' },
    { label: 'OR', category: 'Bit Logic', documentation: 'OR — bitwise OR with current result', insertText: 'OR   ', detail: 'Bitwise OR' },
    { label: 'ORN', category: 'Bit Logic', documentation: 'OR Negated — OR with negated operand', insertText: 'ORN  ', detail: 'Bitwise OR Negated' },
    { label: 'XOR', category: 'Bit Logic', documentation: 'XOR — bitwise exclusive OR with current result', insertText: 'XOR  ', detail: 'Bitwise XOR' },
    { label: 'NOT', category: 'Bit Logic', documentation: 'NOT — inverts the current result (no operand)', insertText: 'NOT', detail: 'Bitwise NOT' },
    // Arithmetic
    { label: 'ADD', category: 'Arithmetic', documentation: 'Add — adds operand to current result', insertText: 'ADD ', detail: 'Addition' },
    { label: 'SUB', category: 'Arithmetic', documentation: 'Subtract — subtracts operand from current result', insertText: 'SUB ', detail: 'Subtraction' },
    { label: 'MUL', category: 'Arithmetic', documentation: 'Multiply — multiplies current result by operand', insertText: 'MUL ', detail: 'Multiplication' },
    { label: 'DIV', category: 'Arithmetic', documentation: 'Divide — divides current result by operand', insertText: 'DIV ', detail: 'Division' },
    { label: 'MOD', category: 'Arithmetic', documentation: 'Modulo — remainder of current result divided by operand', insertText: 'MOD ', detail: 'Modulo' },
    // Comparison
    { label: 'GT', category: 'Comparison', documentation: 'Greater Than — CR = 1 if current result > operand', insertText: 'GT ', detail: 'Greater Than' },
    { label: 'GE', category: 'Comparison', documentation: 'Greater or Equal — CR = 1 if current result >= operand', insertText: 'GE ', detail: 'Greater or Equal' },
    { label: 'EQ', category: 'Comparison', documentation: 'Equal — CR = 1 if current result == operand', insertText: 'EQ ', detail: 'Equal' },
    { label: 'NE', category: 'Comparison', documentation: 'Not Equal — CR = 1 if current result != operand', insertText: 'NE ', detail: 'Not Equal' },
    { label: 'LE', category: 'Comparison', documentation: 'Less or Equal — CR = 1 if current result <= operand', insertText: 'LE ', detail: 'Less or Equal' },
    { label: 'LT', category: 'Comparison', documentation: 'Less Than — CR = 1 if current result < operand', insertText: 'LT ', detail: 'Less Than' },
    // Jump
    { label: 'JMP', category: 'Jump', documentation: 'Jump — unconditional jump to label', insertText: 'JMP  ', detail: 'Unconditional Jump' },
    { label: 'JMPC', category: 'Jump', documentation: 'Jump Conditional — jump if CR = 1', insertText: 'JMPC ', detail: 'Jump if CR true' },
    { label: 'JMPCN', category: 'Jump', documentation: 'Jump Conditional Negated — jump if CR = 0', insertText: 'JMPCN', detail: 'Jump if CR false' },
    // Call
    { label: 'CAL', category: 'Call', documentation: 'Call — unconditional function block call', insertText: 'CAL  ', detail: 'Unconditional Call' },
    // Return
    { label: 'RET', category: 'Return', documentation: 'Return — unconditional return from FB', insertText: 'RET  ', detail: 'Unconditional Return' },
    // Timers
    { label: 'TON', category: 'Timers', documentation: 'On-Delay Timer — Q = TRUE after PT once IN = TRUE', insertText: 'TON ', detail: 'Timer On-Delay' },
    { label: 'TOF', category: 'Timers', documentation: 'Off-Delay Timer — Q = FALSE after PT once IN = FALSE', insertText: 'TOF ', detail: 'Timer Off-Delay' },
    { label: 'TP', category: 'Timers', documentation: 'Pulse Timer — Q = TRUE for PT duration on IN rising edge', insertText: 'TP ', detail: 'Timer Pulse' },
    // Counters
    { label: 'CTU', category: 'Counters', documentation: 'Counter Up — increments on CU rising edge', insertText: 'CTU ', detail: 'Counter Up' },
    { label: 'CTD', category: 'Counters', documentation: 'Counter Down — decrements on CD rising edge', insertText: 'CTD ', detail: 'Counter Down' },
    // Edge
    { label: 'R_TRIG', category: 'Edge', documentation: 'Rising Edge — Q = TRUE for 1 cycle on CLK 0→1', insertText: 'R_TRIG ', detail: 'Rising Edge Detection' },
    { label: 'F_TRIG', category: 'Edge', documentation: 'Falling Edge — Q = TRUE for 1 cycle on CLK 1→0', insertText: 'F_TRIG ', detail: 'Falling Edge Detection' },
    // Flip-Flop
    { label: 'SR', category: 'Flip-Flop', documentation: 'Set-dominant Flip-Flop — S1=TRUE → Q1=TRUE', insertText: 'SR ', detail: 'Set-dominant Bistable' },
    { label: 'RS', category: 'Flip-Flop', documentation: 'Reset-dominant Flip-Flop — R1=TRUE → Q1=FALSE', insertText: 'RS ', detail: 'Reset-dominant Bistable' },
];
/**
 * Generate Monarch language completion items for monaco-editor.
 */
function getILCompletionItems() {
    return IL_COMPLETIONS.map(item => ({
        label: item.label,
        kind: 0,
        detail: `[${item.category}] ${item.detail}`,
        documentation: {
            value: item.documentation,
        },
        insertText: item.insertText,
        range: undefined,
    }));
}
/** Exported for use by other modules */
exports.IL_INSTRUCTION_COUNT = IL_COMPLETIONS.length;
exports.IL_CATEGORY_LIST = Object.keys(IL_CATEGORIES);
//# sourceMappingURL=il-completion.js.map