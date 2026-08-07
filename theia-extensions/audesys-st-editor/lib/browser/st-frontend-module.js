"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * ST Editor Frontend Module
 *
 * Registers the Structured Text language contribution and the ST compile
 * command (F7 → compile via backend napi-rs bridge → Monaco diagnostics).
 */
const inversify_1 = require("@theia/core/shared/inversify");
const common_1 = require("@theia/core/lib/common");
const browser_1 = require("@theia/core/lib/browser");
const st_language_contribution_1 = require("./st-language-contribution");
const st_compile_command_1 = require("./st-compile-command");
exports.default = new inversify_1.ContainerModule((bind) => {
    bind(browser_1.FrontendApplicationContribution).to(st_language_contribution_1.StLanguageContribution);
    // One singleton shared by both contribution interfaces — execute() and
    // onStart() must act on the SAME instance (inversify would otherwise
    // create two copies and compileServer stays null on the command one).
    bind(st_compile_command_1.StCompileCommandContribution).toSelf().inSingletonScope();
    bind(common_1.CommandContribution).toService(st_compile_command_1.StCompileCommandContribution);
    bind(browser_1.KeybindingContribution).toService(st_compile_command_1.StCompileCommandContribution);
    bind(browser_1.FrontendApplicationContribution).toService(st_compile_command_1.StCompileCommandContribution);
});
//# sourceMappingURL=st-frontend-module.js.map