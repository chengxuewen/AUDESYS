"use strict";
/**
 * LD GLSP Frontend Module — unified inversify ContainerModule.
 *
 * Phase 1 (GLSP migration): Editor open/compile/undo/redo superseded by
 * GLSP Theia Integration. Kept: LdToolState, LdGModelState, LdOperationHandler,
 * LdPropertyState, LdPaletteContribution.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("@theia/core/shared/inversify");
const browser_1 = require("@theia/core/lib/browser");
// Tool Palette
const ld_tool_state_1 = require("./tool-palette/ld-tool-state");
const ld_palette_contribution_1 = require("./tool-palette/ld-palette-contribution");
// Server state
const ld_gmodel_state_1 = require("./server/ld-gmodel-state");
const ld_operation_handler_1 = require("./server/ld-operation-handler");
// Property View
const ld_property_state_1 = require("./property-view/ld-property-state");
exports.default = new inversify_1.ContainerModule((bind) => {
    // ── Shared state (singletons) ──────────────────────────────
    bind(ld_tool_state_1.LdToolState).toSelf().inSingletonScope();
    bind(ld_gmodel_state_1.LdGModelState).toSelf().inSingletonScope();
    bind(ld_operation_handler_1.LdOperationHandler).toSelf().inSingletonScope();
    bind(ld_property_state_1.LdPropertyState).toSelf().inSingletonScope();
    // ── Tool Palette ───────────────────────────────────────────
    bind(browser_1.FrontendApplicationContribution).to(ld_palette_contribution_1.LdPaletteContribution);
    // Editor: superseded by GLSP Theia Integration (T1.3+T1.4)
    // LdEditorOpenHandler, LdEditorCommandContribution removed (T1.5)
});
// ── Sprotty Diagram Widget (disabled — Phase 1 GLSP migration) ──
// export { LdSprottyDiagramWidget } from './ld-diagram-widget';
// export { LD_NODE_TYPES } from './ld-diagram-config';
//# sourceMappingURL=ld-glsp-frontend-module.js.map