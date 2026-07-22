/**
 * Monarch tokenizer for IEC 61131-3 Sequential Function Chart (SFC) — text mode.
 *
 * This is a text-only SFC representation. Graphical editing is Phase 2+.
 * The tokenizer highlights SFC structural keywords, action qualifiers, and
 * embedded ST (Structured Text) expressions within TRANSITION conditions.
 *
 * Language features:
 *   - Structural keywords: STEP, TRANSITION, ACTION, SELECTION/SIMULTANEOUS_BRANCH
 *   - Action qualifiers: N, S, R, L, D, P, P0, P1
 *   - Embedded ST expressions inside TRANSITION blocks
 *   - IEC 61131-3 comments: (* ... *)
 *   - Time/Duration/Date literals: T#5s, DATE#2024-01-01
 *   - String and number literals
 *   - GOTO step_name labels
 *
 * NOTE: This module does NOT import from monaco-editor directly.
 * Types are locally-defined for self-containment. In Theia, the Monarch
 * definition is passed to monaco.languages.setMonarchTokensProvider().
 */
type MonarchRule = any[];
interface MonarchLanguage {
    defaultToken: string;
    ignoreCase?: boolean;
    brackets?: Array<{
        open: string;
        close: string;
        token: string;
    }>;
    keywords?: string[];
    typeKeywords?: string[];
    operators?: string[];
    tokenizer: Record<string, MonarchRule[]>;
}
export declare function createSfcMonarchLanguage(): MonarchLanguage;
export {};
//# sourceMappingURL=sfc-language.d.ts.map