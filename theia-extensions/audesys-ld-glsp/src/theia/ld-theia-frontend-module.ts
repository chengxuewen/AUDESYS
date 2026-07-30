/**
 * LD Theia Frontend Module — registers LD diagram editor in Theia browser.
 *
 * Extends GLSPTheiaFrontendModule to bind the LD diagram configuration
 * and language definition. Theia automatically handles file opening,
 * dirty state, save, undo/redo for .ld files.
 *
 * The manual LdEditorOpenHandler ensures .ld file routing even when
 * GLSP's toService() OpenHandler binding doesn't work in inversify 6.2.2.
 * The handler returns undefined so Theia falls through to the
 * GLSPDiagramManager (priority 1001) for actual widget creation.
 */
import { ContainerContext, DiagramConfiguration, GLSPTheiaFrontendModule } from '@eclipse-glsp/theia-integration';
import { OpenHandler } from '@theia/core/lib/browser/opener-service';
import { LdDiagramLanguage } from './ld-language';
import { LdTheiaDiagramConfiguration } from './ld-theia-diagram-configuration';
import { LdEditorOpenHandler } from './ld-theia-opener';
import { injectLdCssVariables } from '../client/ld-css-inject';
import '../client/ld-palette-icons.css';

export class LdTheiaFrontendModule extends GLSPTheiaFrontendModule {
    readonly diagramLanguage = LdDiagramLanguage;

    bindDiagramConfiguration(context: ContainerContext): void {
        context.bind(DiagramConfiguration).to(LdTheiaDiagramConfiguration);
    }

    configure(context: ContainerContext): void {
        context.bind(OpenHandler).to(LdEditorOpenHandler).inSingletonScope();
    }
}

injectLdCssVariables();
export default new LdTheiaFrontendModule();
