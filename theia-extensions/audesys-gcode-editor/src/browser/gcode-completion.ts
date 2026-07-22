/**
 * G-code completion provider for Monaco editor.
 *
 * Provides code completions for RS274/NGC G-code:
 *   - 22 G codes (motion, plane, unit, coordinate system, return, dwell)
 *   - 8 M codes (program control, spindle, tool change)
 *   - 13 axis/parameter words (X/Y/Z/A/B/C/I/J/K/R/F/S/T)
 */

interface CompletionItem {
    label: string;
    kind: number; // monaco.languages.CompletionItemKind.Keyword = 18
    detail: string;
    insertText: string;
}

interface GCodeSnippet {
    label: string;
    detail: string;
    insertText: string;
}

const gCodes: GCodeSnippet[] = [
    // Motion
    { label: 'G0', detail: 'Rapid positioning', insertText: 'G0 ' },
    { label: 'G1', detail: 'Linear interpolation', insertText: 'G1 ' },
    { label: 'G2', detail: 'Clockwise arc', insertText: 'G2 ' },
    { label: 'G3', detail: 'Counter-clockwise arc', insertText: 'G3 ' },
    { label: 'G4', detail: 'Dwell', insertText: 'G4 P${1:1.0}' },
    // Plane selection
    { label: 'G17', detail: 'XY plane selection', insertText: 'G17' },
    { label: 'G18', detail: 'XZ plane selection', insertText: 'G18' },
    { label: 'G19', detail: 'YZ plane selection', insertText: 'G19' },
    // Units
    { label: 'G20', detail: 'Inch units', insertText: 'G20' },
    { label: 'G21', detail: 'Millimeter units', insertText: 'G21' },
    // Reference & coordinate
    { label: 'G28', detail: 'Return to home', insertText: 'G28' },
    { label: 'G53', detail: 'Machine coordinate system', insertText: 'G53 ' },
    { label: 'G54', detail: 'Work coordinate system 1', insertText: 'G54' },
    { label: 'G55', detail: 'Work coordinate system 2', insertText: 'G55' },
    { label: 'G56', detail: 'Work coordinate system 3', insertText: 'G56' },
    { label: 'G57', detail: 'Work coordinate system 4', insertText: 'G57' },
    { label: 'G58', detail: 'Work coordinate system 5', insertText: 'G58' },
    { label: 'G59', detail: 'Work coordinate system 6', insertText: 'G59' },
    // Distance mode
    { label: 'G90', detail: 'Absolute distance mode', insertText: 'G90' },
    { label: 'G91', detail: 'Incremental distance mode', insertText: 'G91' },
    // Other
    { label: 'G92', detail: 'Coordinate system offset', insertText: 'G92 ' },
    { label: 'G94', detail: 'Feed per minute', insertText: 'G94' },
];

const mCodes: GCodeSnippet[] = [
    { label: 'M0', detail: 'Program stop', insertText: 'M0' },
    { label: 'M1', detail: 'Optional stop', insertText: 'M1' },
    { label: 'M2', detail: 'Program end', insertText: 'M2' },
    { label: 'M3', detail: 'Spindle CW', insertText: 'M3 S${1:1000}' },
    { label: 'M4', detail: 'Spindle CCW', insertText: 'M4 S${1:1000}' },
    { label: 'M5', detail: 'Spindle stop', insertText: 'M5' },
    { label: 'M6', detail: 'Tool change', insertText: 'M6 T${1:1}' },
    { label: 'M30', detail: 'Program end + rewind', insertText: 'M30' },
];

const axisWords: GCodeSnippet[] = [
    { label: 'X', detail: 'X axis', insertText: 'X${1:0}' },
    { label: 'Y', detail: 'Y axis', insertText: 'Y${1:0}' },
    { label: 'Z', detail: 'Z axis', insertText: 'Z${1:0}' },
    { label: 'A', detail: 'A axis (rotary)', insertText: 'A${1:0}' },
    { label: 'B', detail: 'B axis (rotary)', insertText: 'B${1:0}' },
    { label: 'C', detail: 'C axis (rotary)', insertText: 'C${1:0}' },
    { label: 'I', detail: 'Arc center X offset', insertText: 'I${1:0}' },
    { label: 'J', detail: 'Arc center Y offset', insertText: 'J${1:0}' },
    { label: 'K', detail: 'Arc center Z offset', insertText: 'K${1:0}' },
    { label: 'R', detail: 'Arc radius', insertText: 'R${1:0}' },
    { label: 'F', detail: 'Feed rate', insertText: 'F${1:100}' },
    { label: 'S', detail: 'Spindle speed', insertText: 'S${1:1000}' },
    { label: 'T', detail: 'Tool number', insertText: 'T${1:1}' },
];

// monaco.languages.CompletionItemKind.Keyword = 18
const KEYWORD_KIND = 18;

function toCompletionItem(snippet: GCodeSnippet): CompletionItem {
    return {
        label: snippet.label,
        kind: KEYWORD_KIND,
        detail: snippet.detail,
        insertText: snippet.insertText,
    };
}

const allCompletions: CompletionItem[] = [
    ...gCodes.map(toCompletionItem),
    ...mCodes.map(toCompletionItem),
    ...axisWords.map(toCompletionItem),
];

/**
 * Get all G-code completion items.
 * Returns plain objects — caller wraps in Monaco's type system.
 */
export function getGCodeCompletions(): ReadonlyArray<CompletionItem> {
    return allCompletions;
}
