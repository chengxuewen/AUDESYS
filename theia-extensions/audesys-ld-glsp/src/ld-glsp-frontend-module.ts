/**
 * LD GLSP Frontend Module — unified inversify ContainerModule.
 *
 * Phase 1 (GLSP migration): Editor open/compile/undo/redo superseded by
 * GLSP Theia Integration. Kept: LdToolState, LdGModelState, LdOperationHandler,
 * LdPropertyState, LdPaletteContribution.
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';

// Tool Palette
import { LdToolState } from './tool-palette/ld-tool-state';
import { LdPaletteContribution } from './tool-palette/ld-palette-contribution';

// Server state
import { LdGModelState } from './server/ld-gmodel-state';
import { LdOperationHandler } from './server/ld-operation-handler';

// Property View
import { LdPropertyState } from './property-view/ld-property-state';

export default new ContainerModule((bind) => {
    // ── Shared state (singletons) ──────────────────────────────

    bind(LdToolState).toSelf().inSingletonScope();
    bind(LdGModelState).toSelf().inSingletonScope();
    bind(LdOperationHandler).toSelf().inSingletonScope();
    bind(LdPropertyState).toSelf().inSingletonScope();

    // ── Tool Palette ───────────────────────────────────────────

    bind(FrontendApplicationContribution).to(LdPaletteContribution);

    // Editor: superseded by GLSP Theia Integration (T1.3+T1.4)
    // LdEditorOpenHandler, LdEditorCommandContribution removed (T1.5)
});

// ── Sprotty Diagram Widget (disabled — Phase 1 GLSP migration) ──
// export { LdSprottyDiagramWidget } from './ld-diagram-widget';
// export { LD_NODE_TYPES } from './ld-diagram-config';
