"use strict";
/**
 * SFC Editor Frontend Module
 *
 * Registers:
 *   1. FrontendApplicationContribution — hooks into Theia startup to register
 *      the SFC language, Monarch tokenizer with Monaco.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("@theia/core/shared/inversify");
const browser_1 = require("@theia/core/lib/browser");
const sfc_contribution_1 = require("./sfc-contribution");
exports.default = new inversify_1.ContainerModule((bind) => {
    bind(browser_1.FrontendApplicationContribution).to(sfc_contribution_1.SfcMonacoContribution).inSingletonScope();
});
//# sourceMappingURL=sfc-frontend-module.js.map