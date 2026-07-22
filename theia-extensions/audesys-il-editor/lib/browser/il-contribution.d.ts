/**
 * IL Monaco Contribution — registers the IL language definition,
 * Monarch tokenizer, and completion provider on Theia startup.
 *
 * Uses Theia's FrontendApplicationContribution pattern so that
 * Monaco is guaranteed to be loaded before we register the language.
 */
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
/** IL language ID used in Monaco */
export declare const IL_LANGUAGE_ID = "il";
export declare const IL_FILE_EXTENSIONS: string[];
export declare class ILMonacoContribution implements FrontendApplicationContribution {
    initialize(): void;
    private registerILLanguage;
}
//# sourceMappingURL=il-contribution.d.ts.map