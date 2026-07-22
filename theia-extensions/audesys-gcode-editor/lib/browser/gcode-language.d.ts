/**
 * Monarch tokenizer for RS274/NGC G-code.
 *
 * Language features:
 *   - G codes: G0-G94 (motion, plane, unit, coordinate system, return, dwell)
 *   - M codes: M0-M30 (program control, spindle, tool change)
 *   - Axis letters: X/Y/Z/A/B/C plus I/J/K/R for arcs
 *   - Feed (F), Spindle speed (S), Tool (T), Dwell (P), Height offset (H)
 *   - Line numbers: N-prefixed
 *   - Variables: #1-#9999
 *   - Comments: parenthesized (nested) and semicolon line comments
 *   - Block delete (/), optional skip (*), program delimiters (%)
 *   - Numbers: integers, decimals, scientific notation, negative
 *
 * NOTE: Parenthesized comments use Monarch's state stack for nesting support.
 * Each '(' pushes '@parenComment' state; each ')' pops one level.
 */
type MonarchRule = any[];
interface MonarchLanguage {
    defaultToken: string;
    ignoreCase?: boolean;
    tokenizer: Record<string, MonarchRule[]>;
}
/**
 * Create a Monarch language definition for RS274/NGC G-code.
 *
 * Returns a plain object compatible with:
 *   monaco.languages.setMonarchTokensProvider('gcode', tokens);
 */
export declare function createGCodeMonarchLanguage(): MonarchLanguage;
export {};
//# sourceMappingURL=gcode-language.d.ts.map