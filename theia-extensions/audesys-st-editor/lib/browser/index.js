"use strict";
/**
 * AUDESYS Structured Text Editor — Browser Entry Point
 *
 * Exports the DI container module for Theia extension discovery.
 * The extension registers:
 *   - .st language (Monarch tokenizer)
 *   - Keyword / type / snippet completion provider
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ST_LANGUAGE_ID = exports.StLanguageContribution = exports.stKeywords = exports.stCompletionItems = exports.createStMonarchLanguage = void 0;
const st_frontend_module_1 = __importDefault(require("./st-frontend-module"));
exports.default = st_frontend_module_1.default;
var st_language_1 = require("./st-language");
Object.defineProperty(exports, "createStMonarchLanguage", { enumerable: true, get: function () { return st_language_1.createStMonarchLanguage; } });
var st_completion_1 = require("./st-completion");
Object.defineProperty(exports, "stCompletionItems", { enumerable: true, get: function () { return st_completion_1.stCompletionItems; } });
Object.defineProperty(exports, "stKeywords", { enumerable: true, get: function () { return st_completion_1.stKeywords; } });
var st_language_contribution_1 = require("./st-language-contribution");
Object.defineProperty(exports, "StLanguageContribution", { enumerable: true, get: function () { return st_language_contribution_1.StLanguageContribution; } });
Object.defineProperty(exports, "ST_LANGUAGE_ID", { enumerable: true, get: function () { return st_language_contribution_1.ST_LANGUAGE_ID; } });
//# sourceMappingURL=index.js.map