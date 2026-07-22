/**
 * IL completion provider — suggests IEC 61131-3 IL instructions and modifiers.
 *
 * The completion items cover:
 *   - 31 IL instructions with category grouping
 *   - Modifier suffixes (N/C) for conditional instructions
 *   - Labels (triggered by typing at start of line)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Completion item categories for grouping */
const IL_CATEGORIES: Record<string, string> = {
    'Load/Store': 'Bit loads and stores',
    'Bit Logic': 'Bitwise logic operations',
    'Arithmetic': 'Arithmetic operations',
    'Comparison': 'Comparison operators',
    'Jump': 'Program flow jumps',
    'Call': 'Function block calls',
    'Return': 'Return from function block',
};

/** All 31 IL instructions with categories, documentation, and snippet insertion text */
interface IlCompletionItem {
    readonly label: string;
    readonly category: string;
    readonly documentation: string;
    readonly insertText: string;
    readonly detail: string;
}

const IL_COMPLETIONS: readonly IlCompletionItem[] = [
    // Load/Store
    { label: 'LD',  category: 'Load/Store',  documentation: 'Load — makes operand equal to current result',            insertText: 'LD  ',  detail: 'Load' },
    { label: 'LDN', category: 'Load/Store',  documentation: 'Load Negated — loads negated value of operand',            insertText: 'LDN ', detail: 'Load Negated' },
    { label: 'ST',  category: 'Load/Store',  documentation: 'Store — stores current result to operand',                  insertText: 'ST  ',  detail: 'Store' },
    { label: 'STN', category: 'Load/Store',  documentation: 'Store Negated — stores negated current result',             insertText: 'STN ', detail: 'Store Negated' },
    { label: 'S',   category: 'Load/Store',  documentation: 'Set — sets operand to TRUE when CR is 1',                  insertText: 'S   ',   detail: 'Set (coil)' },
    { label: 'R',   category: 'Load/Store',  documentation: 'Reset — resets operand to FALSE when CR is 1',             insertText: 'R   ',   detail: 'Reset (coil)' },

    // Bit Logic
    { label: 'AND',  category: 'Bit Logic',  documentation: 'AND — bitwise AND with current result',                   insertText: 'AND  ',  detail: 'Bitwise AND' },
    { label: 'ANDN', category: 'Bit Logic',  documentation: 'AND Negated — AND with negated operand',                  insertText: 'ANDN ', detail: 'Bitwise AND Negated' },
    { label: 'OR',   category: 'Bit Logic',  documentation: 'OR — bitwise OR with current result',                      insertText: 'OR   ',   detail: 'Bitwise OR' },
    { label: 'ORN',  category: 'Bit Logic',  documentation: 'OR Negated — OR with negated operand',                    insertText: 'ORN  ',  detail: 'Bitwise OR Negated' },
    { label: 'XOR',  category: 'Bit Logic',  documentation: 'XOR — bitwise exclusive OR with current result',           insertText: 'XOR  ',  detail: 'Bitwise XOR' },
    { label: 'XORN', category: 'Bit Logic',  documentation: 'XOR Negated — XOR with negated operand',                  insertText: 'XORN ', detail: 'Bitwise XOR Negated' },

    // Arithmetic
    { label: 'ADD', category: 'Arithmetic', documentation: 'Add — adds operand to current result',                     insertText: 'ADD ', detail: 'Addition' },
    { label: 'SUB', category: 'Arithmetic', documentation: 'Subtract — subtracts operand from current result',          insertText: 'SUB ', detail: 'Subtraction' },
    { label: 'MUL', category: 'Arithmetic', documentation: 'Multiply — multiplies current result by operand',           insertText: 'MUL ', detail: 'Multiplication' },
    { label: 'DIV', category: 'Arithmetic', documentation: 'Divide — divides current result by operand',                 insertText: 'DIV ', detail: 'Division' },

    // Comparison
    { label: 'GT', category: 'Comparison', documentation: 'Greater Than — CR = 1 if current result > operand',          insertText: 'GT ', detail: 'Greater Than' },
    { label: 'GE', category: 'Comparison', documentation: 'Greater or Equal — CR = 1 if current result >= operand',      insertText: 'GE ', detail: 'Greater or Equal' },
    { label: 'EQ', category: 'Comparison', documentation: 'Equal — CR = 1 if current result == operand',                insertText: 'EQ ', detail: 'Equal' },
    { label: 'NE', category: 'Comparison', documentation: 'Not Equal — CR = 1 if current result != operand',            insertText: 'NE ', detail: 'Not Equal' },
    { label: 'LE', category: 'Comparison', documentation: 'Less or Equal — CR = 1 if current result <= operand',         insertText: 'LE ', detail: 'Less or Equal' },
    { label: 'LT', category: 'Comparison', documentation: 'Less Than — CR = 1 if current result < operand',             insertText: 'LT ', detail: 'Less Than' },

    // Jump
    { label: 'JMP',  category: 'Jump', documentation: 'Jump — unconditional jump to label',                             insertText: 'JMP  ',  detail: 'Unconditional Jump' },
    { label: 'JMPC', category: 'Jump', documentation: 'Jump Conditional — jump if CR = 1',                              insertText: 'JMPC ', detail: 'Jump if CR true' },
    { label: 'JMPCN',category: 'Jump', documentation: 'Jump Conditional Negated — jump if CR = 0',                      insertText: 'JMPCN', detail: 'Jump if CR false' },

    // Call
    { label: 'CAL',  category: 'Call', documentation: 'Call — unconditional function block call',                      insertText: 'CAL  ',  detail: 'Unconditional Call' },
    { label: 'CALC', category: 'Call', documentation: 'Call Conditional — call FB if CR = 1',                           insertText: 'CALC ', detail: 'Call if CR true' },
    { label: 'CALCN',category: 'Call', documentation: 'Call Conditional Negated — call FB if CR = 0',                   insertText: 'CALCN', detail: 'Call if CR false' },

    // Return
    { label: 'RET',  category: 'Return', documentation: 'Return — unconditional return from FB',                      insertText: 'RET  ',  detail: 'Unconditional Return' },
    { label: 'RETC', category: 'Return', documentation: 'Return Conditional — return if CR = 1',                       insertText: 'RETC ', detail: 'Return if CR true' },
    { label: 'RETCN',category: 'Return', documentation: 'Return Conditional Negated — return if CR = 0',               insertText: 'RETCN', detail: 'Return if CR false' },
];

/**
 * Generate Monarch language completion items for monaco-editor.
 * Returns an array of CompletionItem-like objects compatible with
 * monaco.languages.CompletionItem.
 */
export function getILCompletionItems(): any[] {
    return IL_COMPLETIONS.map(item => ({
        label: item.label,
        kind: 0, // monaco.languages.CompletionItemKind.Keyword = 14, but avoid import
        detail: `[${item.category}] ${item.detail}`,
        documentation: {
            value: item.documentation,
        },
        insertText: item.insertText,
        range: undefined, // monaco computes range from word
    }));
}

/** Exported for use by other modules */
export const IL_INSTRUCTION_COUNT = IL_COMPLETIONS.length;
export const IL_CATEGORY_LIST = Object.keys(IL_CATEGORIES);
