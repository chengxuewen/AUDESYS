/**
 * SFC Monaco Contribution — registers the SFC language definition
 * and Monarch tokenizer on Theia startup.
 *
 * Uses Theia's FrontendApplicationContribution pattern so that
 * Monaco is guaranteed to be loaded before we register the language.
 */
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
/** SFC language ID used in Monaco */
export declare const SFC_LANGUAGE_ID = "sfc";
export declare const SFC_FILE_EXTENSIONS: string[];
export declare class SfcMonacoContribution implements FrontendApplicationContribution {
    initialize(): void;
    private registerSfcLanguage;
}
//# sourceMappingURL=sfc-contribution.d.ts.map