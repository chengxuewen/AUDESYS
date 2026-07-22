/**
 * SFC Monaco Contribution — registers the SFC language definition
 * and Monarch tokenizer on Theia startup.
 *
 * Uses Theia's FrontendApplicationContribution pattern so that
 * Monaco is guaranteed to be loaded before we register the language.
 */

import { injectable } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import * as monaco from '@theia/monaco-editor-core';
import { createSfcMonarchLanguage } from './sfc-language';

/** SFC language ID used in Monaco */
export const SFC_LANGUAGE_ID = 'sfc';
export const SFC_FILE_EXTENSIONS = ['.sfc', '.SFC'];

@injectable()
export class SfcMonacoContribution implements FrontendApplicationContribution {

    initialize(): void {
        this.registerSfcLanguage();
    }

    private registerSfcLanguage(): void {
        // 1. Register the language
        monaco.languages.register({
            id: SFC_LANGUAGE_ID,
            extensions: SFC_FILE_EXTENSIONS,
            aliases: ['IEC 61131-3 SFC', 'Sequential Function Chart', 'SFC'],
        });

        // 2. Register Monarch tokenizer
        monaco.languages.setMonarchTokensProvider(
            SFC_LANGUAGE_ID,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            createSfcMonarchLanguage() as any,
        );
    }
}
