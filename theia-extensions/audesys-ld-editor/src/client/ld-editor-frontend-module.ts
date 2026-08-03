/**
 * LD Editor Frontend Module — React Flow Theia widget DI bindings.
 *
 * D110: GLSP removed; the LD editor is a React Flow ReactWidget.
 * LdOperationHandler runs in frontend memory — the only Theia services
 * needed are FileService (load/save) and the shared LdPropertyState.
 *
 * The OpenHandler is registered manually via OpenerService.addHandler()
 * in onStart (D104 pattern) because Symbol-based OpenHandler bindings
 * are not reliably collected by Theia's ContributionProvider.
 */

import { ContainerModule, injectable, inject } from '@theia/core/shared/inversify';
import {
    ApplicationShell,
    FrontendApplication,
    FrontendApplicationContribution,
    OpenerService,
} from '@theia/core/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';

import { LdPropertyState } from '../property-view/ld-property-state';
import { LdPropertyContribution } from '../property-view/ld-property-contribution';
import { LdEditorOpenHandler } from './ld-editor-opener';

import '@xyflow/react/dist/style.css';

@injectable()
class LdEditorBootstrap implements FrontendApplicationContribution {

    @inject(ApplicationShell)
    private readonly shell!: ApplicationShell;

    @inject(OpenerService)
    private readonly openerService!: OpenerService;

    @inject(FileService)
    private readonly fileService!: FileService;

    @inject(LdPropertyState)
    private readonly propertyState!: LdPropertyState;

    onStart(_app: FrontendApplication): void {
        const handler = new LdEditorOpenHandler(this.shell, this.fileService, this.propertyState);
        this.openerService.addHandler?.(handler);
    }
}

export default new ContainerModule((bind) => {
    // Property view bottom panel (bindings inlined from ld-property-frontend-module;
    // inversify 6.2.2 ContainerModule callbacks have no load()).
    bind(LdPropertyState).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).to(LdPropertyContribution);

    bind(LdEditorBootstrap).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).to(LdEditorBootstrap);
});
