"use strict";
/**
 * ST Language Contribution — registers the Structured Text language,
 * Monarch tokenizer, and completion provider with Monaco on startup.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StLanguageContribution = exports.ST_LANGUAGE_ID = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const monaco = __importStar(require("@theia/monaco-editor-core"));
const st_language_1 = require("./st-language");
const st_completion_1 = require("./st-completion");
exports.ST_LANGUAGE_ID = 'st';
let StLanguageContribution = class StLanguageContribution {
    /** Called by Theia once after the shell is attached and Monaco is ready. */
    onStart(_app) {
        this.registerLanguage();
        this.registerTokenizer();
        this.registerCompletion();
    }
    registerLanguage() {
        // Check if already registered (idempotent)
        const existing = monaco.languages.getLanguages();
        if (existing.some(l => l.id === exports.ST_LANGUAGE_ID)) {
            return;
        }
        monaco.languages.register({
            id: exports.ST_LANGUAGE_ID,
            extensions: ['.st', '.ST'],
            aliases: ['Structured Text', 'st', 'IEC 61131-3 ST'],
            mimetypes: ['text/x-iecst'],
            firstLine: '^.*(PROGRAM|FUNCTION_BLOCK|FUNCTION)\\b',
        });
    }
    registerTokenizer() {
        const tokens = (0, st_language_1.createStMonarchLanguage)();
        monaco.languages.setMonarchTokensProvider(exports.ST_LANGUAGE_ID, tokens);
    }
    registerCompletion() {
        monaco.languages.registerCompletionItemProvider(exports.ST_LANGUAGE_ID, {
            provideCompletionItems: (model, position) => {
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn,
                };
                const kindMap = {
                    Keyword: monaco.languages.CompletionItemKind.Keyword,
                    Type: monaco.languages.CompletionItemKind.TypeParameter,
                    Function: monaco.languages.CompletionItemKind.Function,
                    Snippet: monaco.languages.CompletionItemKind.Snippet,
                };
                const suggestions = st_completion_1.stCompletionItems.map((item) => ({
                    label: item.label,
                    kind: kindMap[item.kind] ?? monaco.languages.CompletionItemKind.Text,
                    detail: item.detail,
                    documentation: item.documentation,
                    insertText: item.insertText ?? item.label,
                    sortText: item.sortText,
                    range,
                }));
                return { suggestions };
            },
        });
    }
};
exports.StLanguageContribution = StLanguageContribution;
exports.StLanguageContribution = StLanguageContribution = __decorate([
    (0, inversify_1.injectable)()
], StLanguageContribution);
//# sourceMappingURL=st-language-contribution.js.map