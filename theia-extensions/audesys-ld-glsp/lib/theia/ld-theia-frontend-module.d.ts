/**
 * LD Theia Frontend Module — registers LD diagram editor in Theia browser.
 *
 * Extends GLSPTheiaFrontendModule to bind the LD diagram configuration
 * and language definition. Theia automatically handles file opening,
 * dirty state, save, undo/redo for .ld files.
 */
import { ContainerContext, GLSPTheiaFrontendModule } from '@eclipse-glsp/theia-integration';
export declare class LdTheiaFrontendModule extends GLSPTheiaFrontendModule {
    readonly diagramLanguage: import("@eclipse-glsp/theia-integration/lib/common").GLSPDiagramLanguage;
    bindDiagramConfiguration(context: ContainerContext): void;
}
declare const _default: LdTheiaFrontendModule;
export default _default;
//# sourceMappingURL=ld-theia-frontend-module.d.ts.map