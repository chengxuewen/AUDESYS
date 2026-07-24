/**
 * LD GLSP Frontend Module — unified inversify ContainerModule.
 *
 * Registers ALL contributions in one module:
 * - LdToolState (shared singleton: palette ↔ editor)
 * - LdGModelState (shared singleton: undo/redo/dirty tracking)
 * - LdOperationHandler (shared singleton: model mutations + compile)
 * - LdPaletteContribution (left panel palette widget)
 * - LdEditorOpenHandler (opens .ld files)
 * - LdEditorCommandContribution (Compile, Undo, Redo, Save commands)
 *
 * This replaces the old ld-palette-frontend-module as the package's single
 * theiaExtensions entry point.
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import {
    CommandContribution,
    MenuContribution,
} from '@theia/core';
import { OpenHandler } from '@theia/core/lib/browser/opener-service';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';

// Tool Palette
import { LdToolState } from './tool-palette/ld-tool-state';
import { LdPaletteContribution } from './tool-palette/ld-palette-contribution';
import { LdPaletteWidget } from './tool-palette/ld-palette-widget';

// Server state
import { LdGModelState } from './server/ld-gmodel-state';
import { LdOperationHandler } from './server/ld-operation-handler';

// Editor
import { LdEditorOpenHandler, LdEditorCommandContribution } from './editor/ld-editor-contribution';

export default new ContainerModule((bind) => {
    // ── Shared state (singletons) ──────────────────────────────

    bind(LdToolState).toSelf().inSingletonScope();
    bind(LdGModelState).toSelf().inSingletonScope();
    bind(LdOperationHandler).toSelf().inSingletonScope();

    // ── Tool Palette ───────────────────────────────────────────

    bind(FrontendApplicationContribution).to(LdPaletteContribution);

    // ── Editor ─────────────────────────────────────────────────

    // OpenHandler: opens .ld files in the LD editor
    bind(LdEditorOpenHandler).toSelf();
    bind(OpenHandler).to(LdEditorOpenHandler);

    // CommandContribution: Compile, Undo, Redo, Save, Add Rung
    bind(CommandContribution).to(LdEditorCommandContribution);

    // MenuContribution: LD commands in Edit menu
    bind(MenuContribution).to(LdEditorCommandContribution);
});
