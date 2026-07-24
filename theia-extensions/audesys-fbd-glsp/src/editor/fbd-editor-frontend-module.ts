/**
 * FBD GLSP Frontend Module — unified inversify ContainerModule for the
 * Function Block Diagram editor.
 *
 * Registers:
 * - FbdToolState (shared singleton: palette ↔ editor)
 * - FbdGModelState (shared singleton: undo/redo/dirty tracking)
 * - FbdOperationHandler (shared singleton: model mutations + compile)
 * - FbdEditorOpenHandler (opens .fbd files)
 * - FbdEditorCommandContribution (Compile, Undo, Redo, Save commands)
 *
 * NOTE: FbdToolState and FbdPaletteContribution are already registered in
 * fbd-palette-frontend-module. This module adds only the editor bindings
 * on top of the palette module.
 *
 * Ponytail: separate palette module + editor module — clean separation.
 * The studio-theia app loads both modules via theiaExtensions in package.json.
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import {
    CommandContribution,
    MenuContribution,
} from '@theia/core';
import { OpenHandler } from '@theia/core/lib/browser/opener-service';

// Server state
import { FbdGModelState } from '../server/fbd-gmodel-state';
import { FbdOperationHandler } from '../server/fbd-operation-handler';

// Editor
import { FbdEditorOpenHandler, FbdEditorCommandContribution } from './fbd-editor-contribution';

export default new ContainerModule((bind) => {
    // ── Shared state (singletons) ──────────────────────────────
    bind(FbdGModelState).toSelf().inSingletonScope();
    bind(FbdOperationHandler).toSelf().inSingletonScope();

    // OpenHandler: opens .fbd files in the FBD editor
    bind(FbdEditorOpenHandler).toSelf();
    bind(OpenHandler).to(FbdEditorOpenHandler);
    bind(CommandContribution).to(FbdEditorCommandContribution);
    bind(MenuContribution).to(FbdEditorCommandContribution);
});
