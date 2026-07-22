"use strict";
/**
 * LD Palette Contribution — registers the LD tool palette widget in the
 * Theia frontend application shell (left panel).
 *
 * This contribution:
 * 1. Creates the LdPaletteWidget on startup
 * 2. Places it in the left panel area
 * 3. Binds the LdToolState as a singleton for dependency injection
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
exports.LdPaletteContribution = exports.LD_PALETTE_TOGGLE_COMMAND = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const application_shell_1 = require("@theia/core/lib/browser/shell/application-shell");
const ld_tool_state_1 = require("./ld-tool-state");
const ld_palette_widget_1 = require("./ld-palette-widget");
exports.LD_PALETTE_TOGGLE_COMMAND = {
    id: 'audesys.ld.togglePalette',
    label: 'LD: Toggle Tool Palette',
};
/**
 * Contribution that adds the LD tool palette to the left panel at startup.
 */
let LdPaletteContribution = class LdPaletteContribution {
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
        const widget = new ld_palette_widget_1.LdPaletteWidget(this.toolState);
        await this.shell.addWidget(widget, {
            area: 'left',
            rank: 200, // ponytail: after file explorer (~100), before outline (~300)
        });
    }
};
exports.LdPaletteContribution = LdPaletteContribution;
exports.LdPaletteContribution = LdPaletteContribution = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)(application_shell_1.ApplicationShell)),
    __param(1, (0, inversify_1.inject)(ld_tool_state_1.LdToolState)),
    __metadata("design:paramtypes", [application_shell_1.ApplicationShell,
        ld_tool_state_1.LdToolState])
], LdPaletteContribution);
//# sourceMappingURL=ld-palette-contribution.js.map