"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LdTheiaFrontendModule = void 0;
/**
 * LD Theia Frontend Module — registers LD diagram editor in Theia browser.
 *
 * Extends GLSPTheiaFrontendModule to bind the LD diagram configuration
 * and language definition. Theia automatically handles file opening,
 * dirty state, save, undo/redo for .ld files.
 */
const theia_integration_1 = require("@eclipse-glsp/theia-integration");
const ld_language_1 = require("./ld-language");
const ld_theia_diagram_configuration_1 = require("./ld-theia-diagram-configuration");
class LdTheiaFrontendModule extends theia_integration_1.GLSPTheiaFrontendModule {
    constructor() {
        super(...arguments);
        this.diagramLanguage = ld_language_1.LdDiagramLanguage;
    }
    bindDiagramConfiguration(context) {
        context.bind(theia_integration_1.DiagramConfiguration).to(ld_theia_diagram_configuration_1.LdTheiaDiagramConfiguration);
    }
}
exports.LdTheiaFrontendModule = LdTheiaFrontendModule;
exports.default = new LdTheiaFrontendModule();
//# sourceMappingURL=ld-theia-frontend-module.js.map