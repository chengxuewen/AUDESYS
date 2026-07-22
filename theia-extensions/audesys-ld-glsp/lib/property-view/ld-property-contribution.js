"use strict";
/**
 * LD Property Contribution — registers the LD property view widget
 * in the Theia frontend application shell (bottom panel).
 *
 * This contribution:
 * 1. Creates the LdPropertyWidget on startup
 * 2. Places it in the bottom panel area
 * 3. Binds the LdPropertyState as a singleton for dependency injection
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
exports.LdPropertyContribution = exports.LD_PROPERTY_TOGGLE_COMMAND = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const application_shell_1 = require("@theia/core/lib/browser/shell/application-shell");
const ld_property_state_1 = require("./ld-property-state");
const ld_property_widget_1 = require("./ld-property-widget");
exports.LD_PROPERTY_TOGGLE_COMMAND = {
    id: 'audesys.ld.toggleProperty',
    label: 'LD: Toggle Property View',
};
/**
 * Contribution that adds the LD property view to the bottom panel at startup.
 */
let LdPropertyContribution = class LdPropertyContribution {
    constructor(shell, propertyState) {
        this.shell = shell;
        this.propertyState = propertyState;
    }
    /**
     * Called after the application shell is attached and when there is no
     * previous layout state to restore (initializeLayout).
     */
    async initializeLayout(_app) {
        await this.openPropertyView();
    }
    /**
     * Fallback: also open on start in case initializeLayout doesn't fire
     * (e.g. with a restored layout that doesn't include our widget).
     * The addWidget call is idempotent if the widget already exists.
     */
    async onStart(_app) {
        // ponytail: addWidget is idempotent per shell id; safe to call twice
        await this.openPropertyView();
    }
    async openPropertyView() {
        const widget = new ld_property_widget_1.LdPropertyWidget(this.propertyState);
        await this.shell.addWidget(widget, {
            area: 'bottom',
            rank: 600, // ponytail: after problems (~500), before terminal (~700)
        });
    }
};
exports.LdPropertyContribution = LdPropertyContribution;
exports.LdPropertyContribution = LdPropertyContribution = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)(application_shell_1.ApplicationShell)),
    __param(1, (0, inversify_1.inject)(ld_property_state_1.LdPropertyState)),
    __metadata("design:paramtypes", [application_shell_1.ApplicationShell,
        ld_property_state_1.LdPropertyState])
], LdPropertyContribution);
//# sourceMappingURL=ld-property-contribution.js.map