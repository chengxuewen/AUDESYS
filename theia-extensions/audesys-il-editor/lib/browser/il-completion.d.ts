/**
 * IL completion provider — suggests IEC 61131-3 IL instructions and modifiers.
 *
 * The completion items cover:
 *   - 31 IL instructions with category grouping
 *   - Modifier suffixes (N/C) for conditional instructions
 *   - Labels (triggered by typing at start of line)
 */
/**
 * Generate Monarch language completion items for monaco-editor.
 * Returns an array of CompletionItem-like objects compatible with
 * monaco.languages.CompletionItem.
 */
export declare function getILCompletionItems(): any[];
/** Exported for use by other modules */
export declare const IL_INSTRUCTION_COUNT: number;
export declare const IL_CATEGORY_LIST: string[];
//# sourceMappingURL=il-completion.d.ts.map