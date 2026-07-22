/**
 * ST Language Contribution — registers the Structured Text language,
 * Monarch tokenizer, and completion provider with Monaco on startup.
 */
import { FrontendApplicationContribution, FrontendApplication } from '@theia/core/lib/browser';
export declare const ST_LANGUAGE_ID = "st";
export declare class StLanguageContribution implements FrontendApplicationContribution {
    /** Called by Theia once after the shell is attached and Monaco is ready. */
    onStart(_app: FrontendApplication): void;
    private registerLanguage;
    private registerTokenizer;
    private registerCompletion;
}
//# sourceMappingURL=st-language-contribution.d.ts.map