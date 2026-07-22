"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SFC_FILE_EXTENSIONS = exports.SFC_LANGUAGE_ID = exports.createSfcMonarchLanguage = void 0;
/**
 * SFC Editor — Browser Entry Point
 *
 * Called by Theia when it loads the "frontend" entry in
 * package.json's `theiaExtensions` array.
 *
 * The ContainerModule registers:
 *   - Monarch tokenizer via MonacoContribution
 *   - SFC language definition (.sfc file extension)
 */
const sfc_frontend_module_1 = __importDefault(require("./sfc-frontend-module"));
const sfc_language_1 = require("./sfc-language");
Object.defineProperty(exports, "createSfcMonarchLanguage", { enumerable: true, get: function () { return sfc_language_1.createSfcMonarchLanguage; } });
const sfc_contribution_1 = require("./sfc-contribution");
Object.defineProperty(exports, "SFC_LANGUAGE_ID", { enumerable: true, get: function () { return sfc_contribution_1.SFC_LANGUAGE_ID; } });
Object.defineProperty(exports, "SFC_FILE_EXTENSIONS", { enumerable: true, get: function () { return sfc_contribution_1.SFC_FILE_EXTENSIONS; } });
exports.default = sfc_frontend_module_1.default;
//# sourceMappingURL=index.js.map