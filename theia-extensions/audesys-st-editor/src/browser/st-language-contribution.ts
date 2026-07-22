/**
 * ST Language Contribution — registers the Structured Text language,
 * Monarch tokenizer, and completion provider with Monaco on startup.
 */

import { injectable } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution, FrontendApplication } from '@theia/core/lib/browser';
import * as monaco from '@theia/monaco-editor-core';
import { createStMonarchLanguage } from './st-language';
import { stCompletionItems } from './st-completion';

export const ST_LANGUAGE_ID = 'st';

@injectable()
export class StLanguageContribution implements FrontendApplicationContribution {
    /** Called by Theia once after the shell is attached and Monaco is ready. */
    onStart(_app: FrontendApplication): void {
        this.registerLanguage();
        this.registerTokenizer();
        this.registerCompletion();
    }

    private registerLanguage(): void {
        // Check if already registered (idempotent)
        const existing = monaco.languages.getLanguages();
        if (existing.some(l => l.id === ST_LANGUAGE_ID)) {
            return;
        }

        monaco.languages.register({
            id: ST_LANGUAGE_ID,
            extensions: ['.st', '.ST'],
            aliases: ['Structured Text', 'st', 'IEC 61131-3 ST'],
            mimetypes: ['text/x-iecst'],
            firstLine: '^.*(PROGRAM|FUNCTION_BLOCK|FUNCTION)\\b',
        });
    }

    private registerTokenizer(): void {
        const tokens = createStMonarchLanguage();
        monaco.languages.setMonarchTokensProvider(
            ST_LANGUAGE_ID,
            tokens as unknown as monaco.languages.IMonarchLanguage,
        );
    }

    private registerCompletion(): void {
        monaco.languages.registerCompletionItemProvider(ST_LANGUAGE_ID, {
            provideCompletionItems: (model, position) => {
                const word = model.getWordUntilPosition(position);
                const range: monaco.IRange = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn,
                };

                const kindMap: Record<string, monaco.languages.CompletionItemKind> = {
                    Keyword: monaco.languages.CompletionItemKind.Keyword,
                    Type: monaco.languages.CompletionItemKind.TypeParameter,
                    Function: monaco.languages.CompletionItemKind.Function,
                    Snippet: monaco.languages.CompletionItemKind.Snippet,
                };

                const suggestions: monaco.languages.CompletionItem[] = stCompletionItems.map(
                    (item): monaco.languages.CompletionItem => ({
                        label: item.label,
                        kind: kindMap[item.kind] ?? monaco.languages.CompletionItemKind.Text,
                        detail: item.detail,
                        documentation: item.documentation,
                        insertText: item.insertText ?? item.label,
                        sortText: item.sortText,
                        range,
                    })
                );

                return { suggestions };
            },
        });
    }
}
