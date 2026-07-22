/**
 * Monarch tokenizer for the "AUDESYS Config" mini-language (.audesys files).
 *
 * This is a LEARNING EXERCISE — not a production language definition.
 * Demonstrates: keyword highlighting, comments, strings, numbers, bracket matching.
 *
 * Language features:
 *   - device, signal, channel, controller, hal – top-level keywords
 *   - String literals with escape sequences
 *   - Single-line (#) and multi-line (### ... ###) comments
 *   - Integer and float numbers
 *   - Bracket/brace matching
 *
 * NOTE: This module does NOT import from monaco-editor directly.
 * It uses locally-defined types for self-containment. In production,
 * the types would come from @theia/monaco's Monaco interfaces.
 */
/**
 * Simplified Monarch tokenizer rule types.
 * Avoids direct monaco-editor dependency for this workshop exercise.
 */
type MonarchRule = any[];
interface MonarchLanguage {
    defaultToken: string;
    ignoreCase?: boolean;
    keywords?: string[];
    typeKeywords?: string[];
    brackets?: Array<{
        open: string;
        close: string;
        token: string;
    }>;
    tokenizer: Record<string, MonarchRule[]>;
}
/**
 * Create a Monarch language definition for "AUDESYS Config".
 *
 * Returns a plain object compatible with:
 *   monaco.languages.setMonarchTokensProvider('audesys-config', tokens);
 *
 * In a production Theia extension, this would be registered in
 * a MonacoContribution or FrontendApplicationContribution.
 */
export declare function createAudESYSConfigMonarchLanguage(): MonarchLanguage;
export {};
//# sourceMappingURL=audesys-config-language.d.ts.map