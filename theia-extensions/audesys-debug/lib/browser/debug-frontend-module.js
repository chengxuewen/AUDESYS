"use strict";
/**
 * AUDESYS Debug Frontend Module — Theia DI bindings.
 *
 * Registers:
 *   - DebugSessionContribution for 'audesys' debug type
 *   - DebugPanelWidget as a bottom panel
 *   - VariablesViewWidget for register inspection
 *   - BreakpointsViewWidget for breakpoint management
 */
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("@theia/core/shared/inversify");
const browser_1 = require("@theia/core/lib/browser");
const debug_session_contribution_1 = require("@theia/debug/lib/browser/debug-session-contribution");
const debug_contribution_1 = require("./debug-contribution");
const debug_panel_widget_1 = require("./debug-panel-widget");
const variables_view_1 = require("./variables-view");
const breakpoints_view_1 = require("./breakpoints-view");
exports.default = new inversify_1.ContainerModule((bind) => {
    // Debug adapter contribution
    bind(debug_session_contribution_1.DebugSessionContribution).to(debug_contribution_1.AudesysDebugSessionContribution).inSingletonScope();
    // Bottom panel widgets
    bind(debug_panel_widget_1.DebugPanelWidget).toSelf().inSingletonScope();
    bind(browser_1.WidgetFactory).toDynamicValue((ctx) => ({
        id: debug_panel_widget_1.DebugPanelWidget.ID,
        createWidget: () => ctx.container.get(debug_panel_widget_1.DebugPanelWidget),
    })).inSingletonScope();
    bind(variables_view_1.VariablesViewWidget).toSelf().inSingletonScope();
    bind(browser_1.WidgetFactory).toDynamicValue((ctx) => ({
        id: variables_view_1.VariablesViewWidget.ID,
        createWidget: () => ctx.container.get(variables_view_1.VariablesViewWidget),
    })).inSingletonScope();
    bind(breakpoints_view_1.BreakpointsViewWidget).toSelf().inSingletonScope();
    bind(browser_1.WidgetFactory).toDynamicValue((ctx) => ({
        id: breakpoints_view_1.BreakpointsViewWidget.ID,
        createWidget: () => ctx.container.get(breakpoints_view_1.BreakpointsViewWidget),
    })).inSingletonScope();
});
//# sourceMappingURL=debug-frontend-module.js.map