"use strict";
/**
 * LD Palette Frontend Module — inversify ContainerModule for DI bindings.
 *
 * Registers:
 * - LdToolState (singleton, shared across palette + future canvas consumers)
 * - LdPaletteContribution (FrontendApplicationContribution)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("@theia/core/shared/inversify");
const browser_1 = require("@theia/core/lib/browser");
const ld_tool_state_1 = require("./ld-tool-state");
const ld_palette_contribution_1 = require("./ld-palette-contribution");
exports.default = new inversify_1.ContainerModule((bind) => {
    // ToolState: singleton so palette and canvas share selection state
    bind(ld_tool_state_1.LdToolState).toSelf().inSingletonScope();
    // Palette contribution: adds widget to left panel on startup
    bind(browser_1.FrontendApplicationContribution).to(ld_palette_contribution_1.LdPaletteContribution);
});
//# sourceMappingURL=ld-palette-frontend-module.js.map