"use strict";
/**
 * IL Editor — Browser Entry Point
 *
 * Called by Theia when it loads the "frontend" entry in
 * package.json's `theiaExtensions` array.
 *
 * The ContainerModule registers:
 *   - Monarch tokenizer via MonacoContribution
 *   - Completion provider for 31 IL instructions
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IL_FILE_EXTENSIONS = exports.IL_LANGUAGE_ID = exports.IL_INSTRUCTION_COUNT = exports.getILCompletionItems = exports.createILMonarchLanguage = void 0;
const il_frontend_module_1 = __importDefault(require("./il-frontend-module"));
const il_language_1 = require("./il-language");
Object.defineProperty(exports, "createILMonarchLanguage", { enumerable: true, get: function () { return il_language_1.createILMonarchLanguage; } });
const il_completion_1 = require("./il-completion");
Object.defineProperty(exports, "getILCompletionItems", { enumerable: true, get: function () { return il_completion_1.getILCompletionItems; } });
Object.defineProperty(exports, "IL_INSTRUCTION_COUNT", { enumerable: true, get: function () { return il_completion_1.IL_INSTRUCTION_COUNT; } });
const il_contribution_1 = require("./il-contribution");
Object.defineProperty(exports, "IL_LANGUAGE_ID", { enumerable: true, get: function () { return il_contribution_1.IL_LANGUAGE_ID; } });
Object.defineProperty(exports, "IL_FILE_EXTENSIONS", { enumerable: true, get: function () { return il_contribution_1.IL_FILE_EXTENSIONS; } });
exports.default = il_frontend_module_1.default;
//# sourceMappingURL=index.js.map