import { injectable } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution, FrontendApplication } from '@theia/core/lib/browser';
import { createGCodeMonarchLanguage } from './gcode-language';
import { getGCodeCompletions } from './gcode-completion';

/**
 * Registers the G-code language with Monaco when the Theia frontend starts.
 *
 * Registers:
 *   1. Language ID: 'gcode'
 *   2. Monarch tokenizer for syntax highlighting
 *   3. Completion provider for G/M codes, axis words
 */
@injectable()
export class GCodeLanguageContribution implements FrontendApplicationContribution {
    private registered = false;

    onStart(_app: FrontendApplication): void {
        if (this.registered) {
            return;
        }
        this.registered = true;

        // Access monaco via the global — @theia/monaco sets this up
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const monaco = (window as any).monaco;
        if (!monaco) {
            return; // Monaco not loaded yet, will be picked up on reload
        }

        // Register language
        monaco.languages.register({ id: 'gcode', extensions: ['.ngc', '.gcode', '.nc', '.cnc'] });

        // Register Monarch tokenizer
        monaco.languages.setMonarchTokensProvider('gcode', createGCodeMonarchLanguage());

        // Register completion provider
        const completions = getGCodeCompletions();
        monaco.languages.registerCompletionItemProvider('gcode', {
            provideCompletionItems: () => ({ suggestions: completions }),
        });
    }
}
