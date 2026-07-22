"use strict";
/**
 * LD Property View Frontend Module — inversify ContainerModule for DI bindings.
 *
 * Registers:
 * - LdPropertyState (singleton, shared across property view + future consumers)
 * - LdPropertyContribution (FrontendApplicationContribution)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("@theia/core/shared/inversify");
const browser_1 = require("@theia/core/lib/browser");
const ld_property_state_1 = require("./ld-property-state");
const ld_property_contribution_1 = require("./ld-property-contribution");
exports.default = new inversify_1.ContainerModule((bind) => {
    // PropertyState: singleton so property view and canvas share selection state
    bind(ld_property_state_1.LdPropertyState).toSelf().inSingletonScope();
    // Property contribution: adds widget to bottom panel on startup
    bind(browser_1.FrontendApplicationContribution).to(ld_property_contribution_1.LdPropertyContribution);
});
//# sourceMappingURL=ld-property-frontend-module.js.map