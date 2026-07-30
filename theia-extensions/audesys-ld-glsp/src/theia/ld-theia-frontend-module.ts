/**
 * LD Theia Frontend Module — registers LD diagram editor in Theia browser.
 *
 * Extends GLSPTheiaFrontendModule to bind the LD diagram configuration
 * and language definition.
 *
 * OpenHandler is registered via a FrontendApplicationContribution that
 * manually constructs LdEditorOpenHandler and calls OpenerService.addHandler()
 * — bypassing the Symbol("OpenHandler") duplication bug in the bundle.
 */
import { ContainerContext, DiagramConfiguration, GLSPTheiaFrontendModule } from '@eclipse-glsp/theia-integration';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { FrontendApplication } from '@theia/core/lib/browser/frontend-application';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { OpenerService } from '@theia/core/lib/browser/opener-service';
import { DiagramServiceProvider } from '@eclipse-glsp/theia-integration/lib/browser';
import { LdDiagramLanguage } from './ld-language';
import { LdTheiaDiagramConfiguration } from './ld-theia-diagram-configuration';
import { LdEditorOpenHandler } from './ld-theia-opener';
import { injectLdCssVariables } from '../client/ld-css-inject';
import '../client/ld-palette-icons.css';
import { injectable, inject } from '@theia/core/shared/inversify';

@injectable()
class LdOpenerBootstrap implements FrontendApplicationContribution {
    @inject(ApplicationShell) shell!: ApplicationShell;
    @inject(DiagramServiceProvider) diagramServiceProvider!: DiagramServiceProvider;
    @inject(OpenerService) openerService!: OpenerService;

    onStart(_app: FrontendApplication): void {
        const handler = new LdEditorOpenHandler(this.shell, this.diagramServiceProvider);
        this.openerService.addHandler?.(handler);
    }
}

export class LdTheiaFrontendModule extends GLSPTheiaFrontendModule {
    readonly diagramLanguage = LdDiagramLanguage;

    bindDiagramConfiguration(context: ContainerContext): void {
        context.bind(DiagramConfiguration).to(LdTheiaDiagramConfiguration);
    }

    configure(context: ContainerContext): void {
        context.bind(LdOpenerBootstrap).toSelf().inSingletonScope();
        context.bind(FrontendApplicationContribution).toService(LdOpenerBootstrap);
    }
}

injectLdCssVariables();
export default new LdTheiaFrontendModule();
