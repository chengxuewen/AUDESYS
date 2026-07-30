/**
 * LD GLSP Frontend Module — inversify ContainerModule.
 *
 * Binds LdGModelState, LdOperationHandler (client-side singletons),
 * and the LD OpenHandler for .ld file routing.
 *
 * ponytail: direct bind(OpenHandler) in plain ContainerModule —
 * avoids GLSP framework's toService() which fails in inversify 6.2.2.
 */
import { ContainerModule } from '@theia/core/shared/inversify';
import { OpenHandler } from '@theia/core/lib/browser/opener-service';

import { LdGModelState } from './server/ld-gmodel-state';
import { LdOperationHandler } from './server/ld-operation-handler';
import { LdEditorOpenHandler } from './theia/ld-theia-opener';

export default new ContainerModule((bind) => {
    bind(LdGModelState).toSelf().inSingletonScope();
    bind(LdOperationHandler).toSelf().inSingletonScope();

    // Direct OpenHandler binding — same pattern as FBD (proven working).
    // GLSP framework's configureDiagramManager() also binds via toService()
    // but that doesn't resolve via ContributionProvider in inversify 6.2.2.
    bind(LdEditorOpenHandler).toSelf().inSingletonScope();
    bind(OpenHandler).to(LdEditorOpenHandler);
});
