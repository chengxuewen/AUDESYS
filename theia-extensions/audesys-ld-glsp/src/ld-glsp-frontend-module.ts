/**
 * LD GLSP Frontend Module — inversify ContainerModule.
 *
 * Binds LdGModelState, LdOperationHandler (client-side singletons).
 * OpenHandler is registered manually via LdOpenerBootstrap
 * (see ld-theia-frontend-module.ts) to bypass Symbol duplication.
 */
import { ContainerModule } from '@theia/core/shared/inversify';

import { LdGModelState } from './server/ld-gmodel-state';
import { LdOperationHandler } from './server/ld-operation-handler';

export default new ContainerModule((bind) => {
    bind(LdGModelState).toSelf().inSingletonScope();
    bind(LdOperationHandler).toSelf().inSingletonScope();
});
