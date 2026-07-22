/**
 * Monarch tokenizer for IEC 61131-3 Structured Text (.st files).
 *
 * Provides syntax highlighting for:
 *   - 50+ IEC keywords (control flow, POU declarations, variable modifiers)
 *   - 20+ IEC types
 *   - (* ... *) block comments + // line comments
 *   - '...' single-quoted and "..." double-quoted strings
 *   - Integers, floats, hex/binary/octal bases, TIME#/T# literals
 *   - Operators (:=, <>, .., **, etc.)
 *   - Bracket/brace matching
 *
 * Usage:
 *   import { createStMonarchLanguage } from './st-language';
 *   monaco.languages.register({ id: 'st' });
 *   monaco.languages.setMonarchTokensProvider('st', createStMonarchLanguage());
 */
type MonarchRule = any[];
export interface MonarchLanguage {
    defaultToken: string;
    ignoreCase?: boolean;
    tokenPostfix?: string;
    keywords?: string[];
    typeKeywords?: string[];
    brackets?: Array<{
        open: string;
        close: string;
        token: string;
    }>;
    tokenizer: Record<string, MonarchRule[]>;
}
export declare function createStMonarchLanguage(): MonarchLanguage;
export {};
//# sourceMappingURL=st-language.d.ts.map