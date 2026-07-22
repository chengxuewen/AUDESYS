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
/** All completions combined, ordered by sortText */
export declare const stCompletionItems: StCompletionItem[];
/**
 * Create a flat keyword list for simple completion scenarios
 * (e.g., basic autocomplete without snippets).
 */
export declare const stKeywords: string[];
//# sourceMappingURL=st-completion.d.ts.map