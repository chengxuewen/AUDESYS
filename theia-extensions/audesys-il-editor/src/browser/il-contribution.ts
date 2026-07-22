/**
 * IL Monaco Contribution — registers the IL language definition,
 * Monarch tokenizer, and completion provider on Theia startup.
 *
 * Uses Theia's FrontendApplicationContribution pattern so that
 * Monaco is guaranteed to be loaded before we register the language.
 */

import { injectable } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import * as monaco from '@theia/monaco-editor-core';
import { createILMonarchLanguage } from './il-language';
import { getILCompletionItems } from './il-completion';

/** IL language ID used in Monaco */
export const IL_LANGUAGE_ID = 'il';
export const IL_FILE_EXTENSIONS = ['.il', '.IL'];

@injectable()
export class ILMonacoContribution implements FrontendApplicationContribution {

    initialize(): void {
        this.registerILLanguage();
    }

    private registerILLanguage(): void {
        // 1. Register the language
        monaco.languages.register({
            id: IL_LANGUAGE_ID,
            extensions: IL_FILE_EXTENSIONS,
            aliases: ['IEC 61131-3 IL', 'Instruction List', 'IL'],
        });

        // 2. Register Monarch tokenizer
        monaco.languages.setMonarchTokensProvider(
            IL_LANGUAGE_ID,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            createILMonarchLanguage() as any,
        );

        // 3. Register completion provider
        monaco.languages.registerCompletionItemProvider(IL_LANGUAGE_ID, {
            provideCompletionItems: () => {
                return { suggestions: getILCompletionItems() };
            },
        });
    }
}
