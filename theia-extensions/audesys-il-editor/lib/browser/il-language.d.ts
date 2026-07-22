/**
 * Monarch tokenizer for IEC 61131-3 Instruction List (IL).
 *
 * IL is a line-oriented, accumulator-based language. Each line consists of
 * an optional label, an instruction mnemonic (possibly with modifiers N/C),
 * and an optional operand.
 *
 * Instruction categories (31 total, from audesys-il-compiler):
 *   Bit loads:     LD, LDN
 *   Bit stores:    ST, STN
 *   Bit set/reset: S, R
 *   Bit logic:     AND, ANDN, OR, ORN, XOR, XORN
 *   Arithmetic:    ADD, SUB, MUL, DIV
 *   Comparison:    GT, GE, EQ, NE, LE, LT
 *   Jumps:         JMP, JMPC, JMPCN
 *   Calls:         CAL, CALC, CALCN
 *   Returns:       RET, RETC, RETCN
 *
 * Modifiers:
 *   N  — negate (e.g. ANDN = AND with negation)
 *   C  — conditional (e.g. JMPC = jump if CR true)
 *   (  — deferred execution
 *
 * Accumulator comments: (* CR = ... *) — describe current accumulator value
 *
 * NOTE: Uses locally-defined types to avoid direct monaco-editor dependency.
 * Compatible with @theia/monaco's setMonarchTokensProvider.
 */
type MonarchRule = any[];
interface MonarchLanguage {
    defaultToken: string;
    ignoreCase: boolean;
    keywords: string[];
    tokenizer: Record<string, MonarchRule[]>;
}
/**
 * Create a Monarch language definition for IEC 61131-3 Instruction List.
 */
export declare function createILMonarchLanguage(): MonarchLanguage;
export {};
//# sourceMappingURL=il-language.d.ts.map