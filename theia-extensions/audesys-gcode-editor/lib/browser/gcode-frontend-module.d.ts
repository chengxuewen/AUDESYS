import { FrontendApplicationContribution, FrontendApplication } from '@theia/core/lib/browser';
/**
 * Registers the G-code language with Monaco when the Theia frontend starts.
 *
 * Registers:
 *   1. Language ID: 'gcode'
 *   2. Monarch tokenizer for syntax highlighting
 *   3. Completion provider for G/M codes, axis words
 */
export declare class GCodeLanguageContribution implements FrontendApplicationContribution {
    private registered;
    onStart(_app: FrontendApplication): void;
}
//# sourceMappingURL=gcode-frontend-module.d.ts.map