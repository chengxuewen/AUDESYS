"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("@theia/core/shared/inversify");
const core_1 = require("@theia/core");
const workshop_playground_contribution_1 = require("./workshop-playground-contribution");
/**
 * Workshop Playground Frontend Module
 *
 * Demonstrates:
 *   1. InversifyJS ContainerModule — the standard DI entry point
 *   2. bind(Interface).to(Implementation) — singleton by default
 *   3. Multiple contributions registered in one module
 */
exports.default = new inversify_1.ContainerModule((bind) => {
    // CommandContribution: registers custom commands
    bind(core_1.CommandContribution).to(workshop_playground_contribution_1.WorkshopPlaygroundCommandContribution);
    // MenuContribution: adds menu items to existing menus
    // Using the same class that implements both interfaces (DRY pattern)
    bind(core_1.MenuContribution).to(workshop_playground_contribution_1.WorkshopPlaygroundCommandContribution);
});
//# sourceMappingURL=workshop-playground-frontend-module.js.map