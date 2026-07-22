/**
 * Completion item provider for IEC 61131-3 Structured Text.
 *
 * Provides:
 *   - Keyword completions with documentation
 *   - IEC type completions
 *   - Standard function/FB completions
 */

export interface StCompletionItem {
    label: string;
    kind: 'Keyword' | 'Type' | 'Function' | 'Snippet';
    detail?: string;
    documentation?: string;
    insertText?: string;
    sortText?: string;
}

/** IEC 61131-3 control-flow keywords with snippets */
const keywordCompletions: StCompletionItem[] = [
    {
        label: 'IF',
        kind: 'Snippet',
        detail: 'IF … END_IF',
        documentation: 'Conditional execution block',
        insertText: 'IF ${1:condition} THEN\n\t${2}\nEND_IF',
        sortText: 'a01',
    },
    {
        label: 'IF_ELSE',
        kind: 'Snippet',
        detail: 'IF … ELSE … END_IF',
        documentation: 'Conditional execution with else branch',
        insertText: 'IF ${1:condition} THEN\n\t${2}\nELSE\n\t${3}\nEND_IF',
        sortText: 'a02',
    },
    {
        label: 'IF_ELSIF',
        kind: 'Snippet',
        detail: 'IF … ELSIF … END_IF',
        documentation: 'Multi-condition if-elsif',
        insertText: 'IF ${1:condition} THEN\n\t${2}\nELSIF ${3:condition2} THEN\n\t${4}\nEND_IF',
        sortText: 'a03',
    },
    {
        label: 'CASE',
        kind: 'Snippet',
        detail: 'CASE … END_CASE',
        documentation: 'Multi-way selection',
        insertText: 'CASE ${1:variable} OF\n\t${2:0}: ${3};\n\t${4:1}: ${5};\nELSE\n\t${6};\nEND_CASE',
        sortText: 'a04',
    },
    {
        label: 'FOR',
        kind: 'Snippet',
        detail: 'FOR … END_FOR',
        documentation: 'Counting loop',
        insertText: 'FOR ${1:i} := ${2:0} TO ${3:10} BY ${4:1} DO\n\t${5}\nEND_FOR',
        sortText: 'a05',
    },
    {
        label: 'WHILE',
        kind: 'Snippet',
        detail: 'WHILE … END_WHILE',
        documentation: 'Pre-condition loop',
        insertText: 'WHILE ${1:condition} DO\n\t${2}\nEND_WHILE',
        sortText: 'a06',
    },
    {
        label: 'REPEAT',
        kind: 'Snippet',
        detail: 'REPEAT … UNTIL … END_REPEAT',
        documentation: 'Post-condition loop',
        insertText: 'REPEAT\n\t${1}\nUNTIL ${2:condition}\nEND_REPEAT',
        sortText: 'a07',
    },
    {
        label: 'FUNCTION',
        kind: 'Snippet',
        detail: 'FUNCTION … END_FUNCTION',
        documentation: 'Function declaration',
        insertText: 'FUNCTION ${1:name} : ${2:RETURN_TYPE}\n\tVAR_INPUT\n\t\t${3}\n\tEND_VAR\n\t${4}\nEND_FUNCTION',
        sortText: 'b01',
    },
    {
        label: 'FUNCTION_BLOCK',
        kind: 'Snippet',
        detail: 'FUNCTION_BLOCK … END_FUNCTION_BLOCK',
        documentation: 'Function block declaration',
        insertText: 'FUNCTION_BLOCK ${1:name}\n\tVAR_INPUT\n\t\t${2}\n\tEND_VAR\n\tVAR_OUTPUT\n\t\t${3}\n\tEND_VAR\n\t${4}\nEND_FUNCTION_BLOCK',
        sortText: 'b02',
    },
    {
        label: 'PROGRAM',
        kind: 'Snippet',
        detail: 'PROGRAM … END_PROGRAM',
        documentation: 'Program declaration',
        insertText: 'PROGRAM ${1:name}\n\tVAR\n\t\t${2}\n\tEND_VAR\n\t${3}\nEND_PROGRAM',
        sortText: 'b03',
    },
    {
        label: 'VAR',
        kind: 'Snippet',
        detail: 'VAR … END_VAR',
        documentation: 'Local variable block',
        insertText: 'VAR\n\t${1}: ${2:INT};\nEND_VAR',
        sortText: 'c01',
    },
    {
        label: 'VAR_INPUT',
        kind: 'Snippet',
        detail: 'VAR_INPUT … END_VAR',
        documentation: 'Input variable block',
        insertText: 'VAR_INPUT\n\t${1}: ${2:INT};\nEND_VAR',
        sortText: 'c02',
    },
    {
        label: 'VAR_OUTPUT',
        kind: 'Snippet',
        detail: 'VAR_OUTPUT … END_VAR',
        documentation: 'Output variable block',
        insertText: 'VAR_OUTPUT\n\t${1}: ${2:INT};\nEND_VAR',
        sortText: 'c03',
    },
    {
        label: 'VAR_IN_OUT',
        kind: 'Snippet',
        detail: 'VAR_IN_OUT … END_VAR',
        documentation: 'In-out (by-reference) variable block',
        insertText: 'VAR_IN_OUT\n\t${1}: ${2:INT};\nEND_VAR',
        sortText: 'c04',
    },
    {
        label: 'TYPE',
        kind: 'Snippet',
        detail: 'TYPE … END_TYPE',
        documentation: 'User-defined type declaration',
        insertText: 'TYPE ${1:name} :\n\t${2}\nEND_TYPE',
        sortText: 'd01',
    },
    {
        label: 'STRUCT',
        kind: 'Snippet',
        detail: 'STRUCT … END_STRUCT',
        documentation: 'Structure type declaration',
        insertText: 'STRUCT\n\t${1:field}: ${2:INT};\nEND_STRUCT',
        sortText: 'd02',
    },
];

/** IEC 61131-3 type names */
const typeCompletions: StCompletionItem[] = [
    { label: 'BOOL', kind: 'Type', detail: 'Boolean (1 bit)', sortText: 'e01' },
    { label: 'BYTE', kind: 'Type', detail: 'Bit string (8 bits)', sortText: 'e02' },
    { label: 'WORD', kind: 'Type', detail: 'Bit string (16 bits)', sortText: 'e03' },
    { label: 'DWORD', kind: 'Type', detail: 'Bit string (32 bits)', sortText: 'e04' },
    { label: 'LWORD', kind: 'Type', detail: 'Bit string (64 bits)', sortText: 'e05' },
    { label: 'SINT', kind: 'Type', detail: 'Signed short integer (8 bits)', sortText: 'e06' },
    { label: 'INT', kind: 'Type', detail: 'Signed integer (16 bits)', sortText: 'e07' },
    { label: 'DINT', kind: 'Type', detail: 'Signed double integer (32 bits)', sortText: 'e08' },
    { label: 'LINT', kind: 'Type', detail: 'Signed long integer (64 bits)', sortText: 'e09' },
    { label: 'USINT', kind: 'Type', detail: 'Unsigned short integer (8 bits)', sortText: 'e10' },
    { label: 'UINT', kind: 'Type', detail: 'Unsigned integer (16 bits)', sortText: 'e11' },
    { label: 'UDINT', kind: 'Type', detail: 'Unsigned double integer (32 bits)', sortText: 'e12' },
    { label: 'ULINT', kind: 'Type', detail: 'Unsigned long integer (64 bits)', sortText: 'e13' },
    { label: 'REAL', kind: 'Type', detail: 'Real number (32 bits, IEEE 754)', sortText: 'e14' },
    { label: 'LREAL', kind: 'Type', detail: 'Long real number (64 bits, IEEE 754)', sortText: 'e15' },
    { label: 'STRING', kind: 'Type', detail: 'Variable-length character string', sortText: 'e16' },
    { label: 'WSTRING', kind: 'Type', detail: 'Variable-length wide-character string', sortText: 'e17' },
    { label: 'TIME', kind: 'Type', detail: 'Duration', sortText: 'e18' },
    { label: 'DATE', kind: 'Type', detail: 'Date', sortText: 'e19' },
    { label: 'TIME_OF_DAY', kind: 'Type', detail: 'Time of day (aliased as TOD)', sortText: 'e20' },
    { label: 'DATE_AND_TIME', kind: 'Type', detail: 'Date and time (aliased as DT)', sortText: 'e21' },
];

/** IEC 61131-3 standard functions and function blocks */
const functionCompletions: StCompletionItem[] = [
    { label: 'ABS', kind: 'Function', detail: 'Absolute value', sortText: 'f01' },
    { label: 'SQRT', kind: 'Function', detail: 'Square root', sortText: 'f02' },
    { label: 'SIN', kind: 'Function', detail: 'Sine (radians)', sortText: 'f03' },
    { label: 'COS', kind: 'Function', detail: 'Cosine (radians)', sortText: 'f04' },
    { label: 'TAN', kind: 'Function', detail: 'Tangent (radians)', sortText: 'f05' },
    { label: 'EXP', kind: 'Function', detail: 'Natural exponential (e^x)', sortText: 'f06' },
    { label: 'LN', kind: 'Function', detail: 'Natural logarithm', sortText: 'f07' },
    { label: 'LOG', kind: 'Function', detail: 'Base-10 logarithm', sortText: 'f08' },
    { label: 'EXPT', kind: 'Function', detail: 'Exponentiation (x^y)', sortText: 'f09' },
    { label: 'SEL', kind: 'Function', detail: 'Binary selection (G ? IN0 : IN1)', sortText: 'f10' },
    { label: 'MUX', kind: 'Function', detail: 'Multiplexer (select from K inputs)', sortText: 'f11' },
    { label: 'MAX', kind: 'Function', detail: 'Maximum of two values', sortText: 'f12' },
    { label: 'MIN', kind: 'Function', detail: 'Minimum of two values', sortText: 'f13' },
    { label: 'LIMIT', kind: 'Function', detail: 'Limit (clamp value to range)', sortText: 'f14' },
    { label: 'SHL', kind: 'Function', detail: 'Shift left (bitwise)', sortText: 'f15' },
    { label: 'SHR', kind: 'Function', detail: 'Shift right (bitwise)', sortText: 'f16' },
    { label: 'ROL', kind: 'Function', detail: 'Rotate left (bitwise)', sortText: 'f17' },
    { label: 'ROR', kind: 'Function', detail: 'Rotate right (bitwise)', sortText: 'f18' },
    { label: 'LEN', kind: 'Function', detail: 'String length', sortText: 'f19' },
    { label: 'CONCAT', kind: 'Function', detail: 'String concatenation', sortText: 'f20' },
    { label: 'TRUNC', kind: 'Function', detail: 'Truncate REAL to INT', sortText: 'f21' },
    { label: 'TP', kind: 'Function', detail: 'Timer pulse (IEC FB)', sortText: 'g01' },
    { label: 'TON', kind: 'Function', detail: 'Timer on-delay (IEC FB)', sortText: 'g02' },
    { label: 'TOF', kind: 'Function', detail: 'Timer off-delay (IEC FB)', sortText: 'g03' },
    { label: 'CTU', kind: 'Function', detail: 'Counter up (IEC FB)', sortText: 'g04' },
    { label: 'CTD', kind: 'Function', detail: 'Counter down (IEC FB)', sortText: 'g05' },
    { label: 'SR', kind: 'Function', detail: 'Set-dominant bistable (IEC FB)', sortText: 'g06' },
    { label: 'RS', kind: 'Function', detail: 'Reset-dominant bistable (IEC FB)', sortText: 'g07' },
    { label: 'R_TRIG', kind: 'Function', detail: 'Rising edge detector (IEC FB)', sortText: 'g08' },
    { label: 'F_TRIG', kind: 'Function', detail: 'Falling edge detector (IEC FB)', sortText: 'g09' },
];

/** All completions combined, ordered by sortText */
export const stCompletionItems: StCompletionItem[] = [
    ...keywordCompletions,
    ...typeCompletions,
    ...functionCompletions,
];

/**
 * Create a flat keyword list for simple completion scenarios
 * (e.g., basic autocomplete without snippets).
 */
export const stKeywords: string[] = [
    // Control flow
    'IF', 'THEN', 'ELSE', 'ELSIF', 'END_IF',
    'FOR', 'TO', 'BY', 'DO', 'END_FOR',
    'WHILE', 'DO', 'END_WHILE',
    'REPEAT', 'UNTIL', 'END_REPEAT',
    'CASE', 'OF', 'END_CASE',
    'RETURN', 'EXIT', 'CONTINUE',
    // POU
    'PROGRAM', 'FUNCTION', 'FUNCTION_BLOCK',
    'END_PROGRAM', 'END_FUNCTION', 'END_FUNCTION_BLOCK',
    // Variables
    'VAR', 'END_VAR', 'VAR_INPUT', 'VAR_OUTPUT', 'VAR_IN_OUT',
    'VAR_GLOBAL', 'VAR_TEMP', 'VAR_EXTERNAL',
    'AT', 'RETAIN', 'CONSTANT',
    // Types
    'TYPE', 'END_TYPE', 'STRUCT', 'END_STRUCT', 'ENUM', 'END_ENUM',
    'ARRAY', 'OF', 'REF_TO',
    // Literals
    'TRUE', 'FALSE', 'NULL',
    // Operators
    'AND', 'OR', 'XOR', 'NOT', 'MOD',
];
