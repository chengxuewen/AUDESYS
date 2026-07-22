"use strict";
/**
 * FBD Palette Frontend Module — inversify ContainerModule for DI bindings.
 *
 * Registers:
 * - FbdToolState (singleton, shared across palette + future canvas consumers)
 * - FbdPaletteContribution (FrontendApplicationContribution)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("@theia/core/shared/inversify");
const browser_1 = require("@theia/core/lib/browser");
const fbd_tool_state_1 = require("./fbd-tool-state");
const fbd_palette_contribution_1 = require("./fbd-palette-contribution");
exports.default = new inversify_1.ContainerModule((bind) => {
    // ToolState: singleton so palette and canvas share selection state
    bind(fbd_tool_state_1.FbdToolState).toSelf().inSingletonScope();
    // Palette contribution: adds widget to left panel on startup
    bind(browser_1.FrontendApplicationContribution).to(fbd_palette_contribution_1.FbdPaletteContribution);
});
//# sourceMappingURL=fbd-palette-frontend-module.js.map