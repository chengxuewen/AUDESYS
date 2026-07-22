/**
 * IL Editor — Browser Entry Point
 *
 * Called by Theia when it loads the "frontend" entry in
 * package.json's `theiaExtensions` array.
 *
 * The ContainerModule registers:
 *   - Monarch tokenizer via MonacoContribution
 *   - Completion provider for 31 IL instructions
 */

import frontendModule from './il-frontend-module';
import { createILMonarchLanguage } from './il-language';
import { getILCompletionItems, IL_INSTRUCTION_COUNT } from './il-completion';
import { IL_LANGUAGE_ID, IL_FILE_EXTENSIONS } from './il-contribution';

export default frontendModule;

export {
    createILMonarchLanguage,
    getILCompletionItems,
    IL_INSTRUCTION_COUNT,
    IL_LANGUAGE_ID,
    IL_FILE_EXTENSIONS,
};
