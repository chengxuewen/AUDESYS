/**
 * LD Theia Frontend Module — registers LD diagram editor in Theia browser.
 *
 * Extends GLSPTheiaFrontendModule to bind the LD diagram configuration
 * and language definition. Theia automatically handles file opening,
 * dirty state, save, undo/redo for .ld files.
 *
 * OpenHandler registration is in ld-glsp-frontend-module.ts
 * (plain ContainerModule, direct bind — same pattern as FBD).
 */
import { ContainerContext, DiagramConfiguration, GLSPTheiaFrontendModule } from '@eclipse-glsp/theia-integration';
import { LdDiagramLanguage } from './ld-language';
import { LdTheiaDiagramConfiguration } from './ld-theia-diagram-configuration';
import { injectLdCssVariables } from '../client/ld-css-inject';
import '../client/ld-palette-icons.css';

export class LdTheiaFrontendModule extends GLSPTheiaFrontendModule {
    readonly diagramLanguage = LdDiagramLanguage;

    bindDiagramConfiguration(context: ContainerContext): void {
        context.bind(DiagramConfiguration).to(LdTheiaDiagramConfiguration);
    }
}

injectLdCssVariables();
export default new LdTheiaFrontendModule();
