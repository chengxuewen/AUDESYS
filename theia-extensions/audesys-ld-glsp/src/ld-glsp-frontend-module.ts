/**
 * LD GLSP Frontend Module — inversify ContainerModule.
 *
 * Phase 2 (GLSP migration): Palette moved to server-side ToolPaletteItemProvider.
 * Kept: LdGModelState, LdOperationHandler (client-side singletons).
 */
import { ContainerModule } from '@theia/core/shared/inversify';

// Server state (client-side singletons)
import { LdGModelState } from './server/ld-gmodel-state';
import { LdOperationHandler } from './server/ld-operation-handler';

export default new ContainerModule((bind) => {
    bind(LdGModelState).toSelf().inSingletonScope();
    bind(LdOperationHandler).toSelf().inSingletonScope();
});
