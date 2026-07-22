"use strict";
/**
 * FBD Palette Contribution — registers the FBD tool palette widget in the
 * Theia frontend application shell (left panel).
 *
 * This contribution:
 * 1. Creates the FbdPaletteWidget on startup
 * 2. Places it in the left panel area
 * 3. Binds the FbdToolState as a singleton for dependency injection
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FbdPaletteContribution = exports.FBD_PALETTE_TOGGLE_COMMAND = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const application_shell_1 = require("@theia/core/lib/browser/shell/application-shell");
const fbd_tool_state_1 = require("./fbd-tool-state");
const fbd_palette_widget_1 = require("./fbd-palette-widget");
exports.FBD_PALETTE_TOGGLE_COMMAND = {
    id: 'audesys.fbd.togglePalette',
    label: 'FBD: Toggle Tool Palette',
};
/**
 * Contribution that adds the FBD tool palette to the left panel at startup.
 */
let FbdPaletteContribution = class FbdPaletteContribution {
    constructor(shell, toolState) {
        this.shell = shell;
        this.toolState = toolState;
    }
    /**
     * Called after the application shell is attached and when there is no
     * previous layout state to restore (initializeLayout).
     *
     * This ensures the palette appears on first launch but respects
     * saved layouts on subsequent launches.
     */
    async initializeLayout(app) {
        await this.openPalette();
    }
    /**
     * Fallback: also open on start in case initializeLayout doesn't fire
     * (e.g. with a restored layout that doesn't include our widget).
     * The addWidget call is idempotent if the widget already exists.
     */
    async onStart(app) {
        // ponytail: addWidget is idempotent per shell id; safe to call twice
        await this.openPalette();
    }
    async openPalette() {
        const widget = new fbd_palette_widget_1.FbdPaletteWidget(this.toolState);
        await this.shell.addWidget(widget, {
            area: 'left',
            rank: 210, // ponytail: after LD palette (~200), before outline (~300)
        });
    }
};
exports.FbdPaletteContribution = FbdPaletteContribution;
exports.FbdPaletteContribution = FbdPaletteContribution = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)(application_shell_1.ApplicationShell)),
    __param(1, (0, inversify_1.inject)(fbd_tool_state_1.FbdToolState)),
    __metadata("design:paramtypes", [application_shell_1.ApplicationShell,
        fbd_tool_state_1.FbdToolState])
], FbdPaletteContribution);
//# sourceMappingURL=fbd-palette-contribution.js.map