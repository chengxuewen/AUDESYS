"use strict";
/**
 * ST Editor Frontend Module
 *
 * Registers the Structured Text language contribution
 * via Theia's DI container.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("@theia/core/shared/inversify");
const browser_1 = require("@theia/core/lib/browser");
const st_language_contribution_1 = require("./st-language-contribution");
exports.default = new inversify_1.ContainerModule((bind) => {
    bind(browser_1.FrontendApplicationContribution).to(st_language_contribution_1.StLanguageContribution);
});
//# sourceMappingURL=st-frontend-module.js.map