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
    kind: number;
    detail: string;
    insertText: string;
}
/**
 * Get all G-code completion items.
 * Returns plain objects — caller wraps in Monaco's type system.
 */
export declare function getGCodeCompletions(): ReadonlyArray<CompletionItem>;
export {};
//# sourceMappingURL=gcode-completion.d.ts.map