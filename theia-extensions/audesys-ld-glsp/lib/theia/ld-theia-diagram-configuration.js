"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LdTheiaDiagramConfiguration = void 0;
/**
 * LD Theia Diagram Configuration — client-side diagram type registration.
 *
 * Specifies the diagram type identifier that the GLSP client uses to
 * match incoming GModel data to the correct diagram editor.
 */
const client_1 = require("@eclipse-glsp/client");
const browser_1 = require("@eclipse-glsp/theia-integration/lib/browser");
const ld_language_1 = require("./ld-language");
const ld_glsp_client_module_1 = __importDefault(require("../client/ld-glsp-client-module"));
class LdTheiaDiagramConfiguration extends browser_1.GLSPDiagramConfiguration {
    get diagramType() {
        return ld_language_1.LdDiagramLanguage.diagramType;
    }
    configureContainer(container, ...containerConfiguration) {
        (0, client_1.initializeDiagramContainer)(container, ld_glsp_client_module_1.default, ...containerConfiguration);
    }
}
exports.LdTheiaDiagramConfiguration = LdTheiaDiagramConfiguration;
//# sourceMappingURL=ld-theia-diagram-configuration.js.map