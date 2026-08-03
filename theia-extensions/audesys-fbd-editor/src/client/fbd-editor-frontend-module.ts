/**
 * FBD Editor Frontend Module — React Flow Theia widget DI bindings.
 *
 * D110: GLSP removed; the FBD editor is a React Flow ReactWidget.
 * FbdOperationHandler runs in frontend memory — the only Theia service
 * needed is FileService (load/save).
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

import { FbdEditorOpenHandler } from './fbd-editor-opener';

import '@xyflow/react/dist/style.css';

@injectable()
class FbdEditorBootstrap implements FrontendApplicationContribution {

    @inject(ApplicationShell)
    private readonly shell!: ApplicationShell;

    @inject(OpenerService)
    private readonly openerService!: OpenerService;

    @inject(FileService)
    private readonly fileService!: FileService;

    onStart(_app: FrontendApplication): void {
        const handler = new FbdEditorOpenHandler(this.shell, this.fileService);
        this.openerService.addHandler?.(handler);
    }
}

export default new ContainerModule((bind) => {
    bind(FbdEditorBootstrap).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).to(FbdEditorBootstrap);
});
