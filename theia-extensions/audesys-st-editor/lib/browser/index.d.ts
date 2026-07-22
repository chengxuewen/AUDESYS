/**
 * AUDESYS Structured Text Editor — Browser Entry Point
 *
 * Exports the DI container module for Theia extension discovery.
 * The extension registers:
 *   - .st language (Monarch tokenizer)
 *   - Keyword / type / snippet completion provider
 */
import frontendModule from './st-frontend-module';
export default frontendModule;
export { createStMonarchLanguage } from './st-language';
export type { MonarchLanguage } from './st-language';
export { stCompletionItems, stKeywords } from './st-completion';
export type { StCompletionItem } from './st-completion';
export { StLanguageContribution, ST_LANGUAGE_ID } from './st-language-contribution';
//# sourceMappingURL=index.d.ts.map