"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("@theia/core/shared/inversify");
const browser_1 = require("@theia/core/lib/browser");
const gcode_frontend_module_1 = require("./gcode-frontend-module");
exports.default = new inversify_1.ContainerModule((bind) => {
    bind(browser_1.FrontendApplicationContribution).to(gcode_frontend_module_1.GCodeLanguageContribution);
});
//# sourceMappingURL=index.js.map