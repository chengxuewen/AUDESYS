/**
 * FBD Theia Frontend Module — registers FBD diagram editor in Theia browser.
 *
 * Extends GLSPTheiaFrontendModule to bind the FBD diagram configuration
 * and language definition.
 *
 * OpenHandler is registered via a FrontendApplicationContribution that
 * manually constructs FbdEditorOpenHandler and calls OpenerService.addHandler()
 * — bypassing the Symbol("OpenHandler") duplication bug in the bundle.
 */
import { ContainerContext, DiagramConfiguration, GLSPTheiaFrontendModule } from '@eclipse-glsp/theia-integration';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { FrontendApplication } from '@theia/core/lib/browser/frontend-application';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { OpenerService } from '@theia/core/lib/browser/opener-service';
import { DiagramServiceProvider } from '@eclipse-glsp/theia-integration/lib/browser';
import { FbdDiagramLanguage } from './fbd-language';
import { FbdTheiaDiagramConfiguration } from './fbd-theia-diagram-configuration';
import { FbdEditorOpenHandler } from './fbd-theia-opener';
import { injectFbdCssVariables } from '../client/fbd-css-inject';
import { injectable, inject } from '@theia/core/shared/inversify';

@injectable()
class FbdOpenerBootstrap implements FrontendApplicationContribution {
    @inject(ApplicationShell) shell!: ApplicationShell;
    @inject(DiagramServiceProvider) diagramServiceProvider!: DiagramServiceProvider;
    @inject(OpenerService) openerService!: OpenerService;

    onStart(_app: FrontendApplication): void {
        const handler = new FbdEditorOpenHandler(this.shell, this.diagramServiceProvider);
        this.openerService.addHandler?.(handler);
    }
}

export class FbdTheiaFrontendModule extends GLSPTheiaFrontendModule {
    readonly diagramLanguage = FbdDiagramLanguage;

    bindDiagramConfiguration(context: ContainerContext): void {
        context.bind(DiagramConfiguration).to(FbdTheiaDiagramConfiguration);
    }

    configure(context: ContainerContext): void {
        context.bind(FbdOpenerBootstrap).toSelf().inSingletonScope();
        context.bind(FrontendApplicationContribution).toService(FbdOpenerBootstrap);
    }
}

injectFbdCssVariables();
export default new FbdTheiaFrontendModule();
