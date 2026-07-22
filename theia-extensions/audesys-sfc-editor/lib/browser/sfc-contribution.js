"use strict";
/**
 * SFC Monaco Contribution — registers the SFC language definition
 * and Monarch tokenizer on Theia startup.
 *
 * Uses Theia's FrontendApplicationContribution pattern so that
 * Monaco is guaranteed to be loaded before we register the language.
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
exports.SfcMonacoContribution = exports.SFC_FILE_EXTENSIONS = exports.SFC_LANGUAGE_ID = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const monaco = __importStar(require("@theia/monaco-editor-core"));
const sfc_language_1 = require("./sfc-language");
/** SFC language ID used in Monaco */
exports.SFC_LANGUAGE_ID = 'sfc';
exports.SFC_FILE_EXTENSIONS = ['.sfc', '.SFC'];
let SfcMonacoContribution = class SfcMonacoContribution {
    initialize() {
        this.registerSfcLanguage();
    }
    registerSfcLanguage() {
        // 1. Register the language
        monaco.languages.register({
            id: exports.SFC_LANGUAGE_ID,
            extensions: exports.SFC_FILE_EXTENSIONS,
            aliases: ['IEC 61131-3 SFC', 'Sequential Function Chart', 'SFC'],
        });
        // 2. Register Monarch tokenizer
        monaco.languages.setMonarchTokensProvider(exports.SFC_LANGUAGE_ID, 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (0, sfc_language_1.createSfcMonarchLanguage)());
    }
};
exports.SfcMonacoContribution = SfcMonacoContribution;
exports.SfcMonacoContribution = SfcMonacoContribution = __decorate([
    (0, inversify_1.injectable)()
], SfcMonacoContribution);
//# sourceMappingURL=sfc-contribution.js.map