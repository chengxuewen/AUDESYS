"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GCodeLanguageContribution = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const gcode_language_1 = require("./gcode-language");
const gcode_completion_1 = require("./gcode-completion");
/**
 * Registers the G-code language with Monaco when the Theia frontend starts.
 *
 * Registers:
 *   1. Language ID: 'gcode'
 *   2. Monarch tokenizer for syntax highlighting
 *   3. Completion provider for G/M codes, axis words
 */
let GCodeLanguageContribution = class GCodeLanguageContribution {
    constructor() {
        this.registered = false;
    }
    onStart(_app) {
        if (this.registered) {
            return;
        }
        this.registered = true;
        // Access monaco via the global — @theia/monaco sets this up
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const monaco = window.monaco;
        if (!monaco) {
            return; // Monaco not loaded yet, will be picked up on reload
        }
        // Register language
        monaco.languages.register({ id: 'gcode', extensions: ['.ngc', '.gcode', '.nc', '.cnc'] });
        // Register Monarch tokenizer
        monaco.languages.setMonarchTokensProvider('gcode', (0, gcode_language_1.createGCodeMonarchLanguage)());
        // Register completion provider
        const completions = (0, gcode_completion_1.getGCodeCompletions)();
        monaco.languages.registerCompletionItemProvider('gcode', {
            provideCompletionItems: () => ({ suggestions: completions }),
        });
    }
};
exports.GCodeLanguageContribution = GCodeLanguageContribution;
exports.GCodeLanguageContribution = GCodeLanguageContribution = __decorate([
    (0, inversify_1.injectable)()
], GCodeLanguageContribution);
//# sourceMappingURL=gcode-frontend-module.js.map