"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("@theia/core/shared/inversify");
const core_1 = require("@theia/core");
const opener_service_1 = require("@theia/core/lib/browser/opener-service");
// Server state
const fbd_gmodel_state_1 = require("../server/fbd-gmodel-state");
const fbd_operation_handler_1 = require("../server/fbd-operation-handler");
// Editor
const fbd_editor_contribution_1 = require("./fbd-editor-contribution");
exports.default = new inversify_1.ContainerModule((bind) => {
    // ── Shared state (singletons) ──────────────────────────────
    bind(fbd_gmodel_state_1.FbdGModelState).toSelf().inSingletonScope();
    bind(fbd_operation_handler_1.FbdOperationHandler).toSelf().inSingletonScope();
    // OpenHandler: opens .fbd files in the FBD editor
    bind(fbd_editor_contribution_1.FbdEditorOpenHandler).toSelf();
    bind(opener_service_1.OpenHandler).to(fbd_editor_contribution_1.FbdEditorOpenHandler);
    bind(core_1.CommandContribution).to(fbd_editor_contribution_1.FbdEditorCommandContribution);
    bind(core_1.MenuContribution).to(fbd_editor_contribution_1.FbdEditorCommandContribution);
});
//# sourceMappingURL=fbd-editor-frontend-module.js.map