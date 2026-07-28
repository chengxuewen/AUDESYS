/**
 * LD GLSP Frontend Module — unified inversify ContainerModule.
 *
 * Phase 1 (GLSP migration): Editor open/compile/undo/redo superseded by
 * GLSP Theia Integration. Kept: LdToolState, LdGModelState, LdOperationHandler,
 * LdPaletteContribution. (LdPropertyState bound in ld-property-frontend-module)
 */
import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';

// Tool Palette
import { LdToolState } from './tool-palette/ld-tool-state';
import { LdPaletteContribution } from './tool-palette/ld-palette-contribution';

// Server state
import { LdGModelState } from './server/ld-gmodel-state';
import { LdOperationHandler } from './server/ld-operation-handler';

export default new ContainerModule((bind) => {
    // Shared state (singletons)
    bind(LdToolState).toSelf().inSingletonScope();
    bind(LdGModelState).toSelf().inSingletonScope();
    bind(LdOperationHandler).toSelf().inSingletonScope();
    // LdPropertyState: bound in property-view/ld-property-frontend-module.ts

    // Tool Palette
    bind(FrontendApplicationContribution).to(LdPaletteContribution);
});
