/**
 * LD Theia Frontend Module — registers LD diagram editor in Theia browser.
 *
 * Extends GLSPTheiaFrontendModule to bind the LD diagram configuration
 * and language definition. Theia automatically handles file opening,
 * dirty state, save, undo/redo for .ld files.
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

// Inject LD CSS variables on module load (guard prevents double injection)
injectLdCssVariables();
export default new LdTheiaFrontendModule();
