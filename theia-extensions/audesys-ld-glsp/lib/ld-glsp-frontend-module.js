"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("@theia/core/shared/inversify");
const core_1 = require("@theia/core");
const opener_service_1 = require("@theia/core/lib/browser/opener-service");
const browser_1 = require("@theia/core/lib/browser");
// Tool Palette
const ld_tool_state_1 = require("./tool-palette/ld-tool-state");
const ld_palette_contribution_1 = require("./tool-palette/ld-palette-contribution");
// Server state
const ld_gmodel_state_1 = require("./server/ld-gmodel-state");
const ld_operation_handler_1 = require("./server/ld-operation-handler");
// Editor
const ld_editor_contribution_1 = require("./editor/ld-editor-contribution");
exports.default = new inversify_1.ContainerModule((bind) => {
    // ── Shared state (singletons) ──────────────────────────────
    bind(ld_tool_state_1.LdToolState).toSelf().inSingletonScope();
    bind(ld_gmodel_state_1.LdGModelState).toSelf().inSingletonScope();
    bind(ld_operation_handler_1.LdOperationHandler).toSelf().inSingletonScope();
    // ── Tool Palette ───────────────────────────────────────────
    bind(browser_1.FrontendApplicationContribution).to(ld_palette_contribution_1.LdPaletteContribution);
    // ── Editor ─────────────────────────────────────────────────
    // OpenHandler: opens .ld files in the LD editor
    bind(ld_editor_contribution_1.LdEditorOpenHandler).toSelf();
    bind(opener_service_1.OpenHandler).to(ld_editor_contribution_1.LdEditorOpenHandler);
    // CommandContribution: Compile, Undo, Redo, Save, Add Rung
    bind(core_1.CommandContribution).to(ld_editor_contribution_1.LdEditorCommandContribution);
    // MenuContribution: LD commands in Edit menu
    bind(core_1.MenuContribution).to(ld_editor_contribution_1.LdEditorCommandContribution);
});
//# sourceMappingURL=ld-glsp-frontend-module.js.map