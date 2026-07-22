"use strict";
/**
 * IL Editor Frontend Module
 *
 * Registers:
 *   1. FrontendApplicationContribution — hooks into Theia startup to register
 *      the IL language, Monarch tokenizer, and completion provider with Monaco.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("@theia/core/shared/inversify");
const browser_1 = require("@theia/core/lib/browser");
const il_contribution_1 = require("./il-contribution");
exports.default = new inversify_1.ContainerModule((bind) => {
    bind(browser_1.FrontendApplicationContribution).to(il_contribution_1.ILMonacoContribution).inSingletonScope();
});
//# sourceMappingURL=il-frontend-module.js.map