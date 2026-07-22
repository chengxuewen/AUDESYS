"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("@theia/core/shared/inversify");
const label_provider_1 = require("@theia/core/lib/browser/label-provider");
const icon_theme_contribution_1 = require("@theia/core/lib/browser/icon-theme-contribution");
const common_1 = require("@theia/core/lib/common");
const browser_1 = require("@theia/core/lib/browser");
const iec_navigator_decorator_1 = require("./iec-navigator-decorator");
const iec_icons_1 = require("./iec-icons");
const iec_new_file_contribution_1 = require("./iec-new-file-contribution");
const iec_context_menu_1 = require("./iec-context-menu");
const signal_browser_contribution_1 = require("./signal-browser/signal-browser-contribution");
const scope_view_contribution_1 = require("./scope-view/scope-view-contribution");
const signal_bridge_protocol_1 = require("../common/signal-bridge-protocol");
exports.default = new inversify_1.ContainerModule((bind) => {
    // IEC 61131-3 navigator decorator — appends [Program]/[HMI]/[CNC] labels
    bind(label_provider_1.LabelProviderContribution).to(iec_navigator_decorator_1.IecNavigatorDecorator).inSingletonScope();
    // IEC 61131-3 file icon theme
    bind(icon_theme_contribution_1.IconThemeContribution).to(iec_icons_1.IecFileIconTheme).inSingletonScope();
    // New File wizard entries for IEC languages + HMI + CNC
    bind(common_1.CommandContribution).to(iec_new_file_contribution_1.IecNewFileContribution).inSingletonScope();
    bind(common_1.MenuContribution).to(iec_new_file_contribution_1.IecNewFileContribution).inSingletonScope();
    // Context menu: Compile / Deploy / Validate (right-click in navigator)
    bind(common_1.CommandContribution).to(iec_context_menu_1.IecContextMenuContribution).inSingletonScope();
    bind(common_1.MenuContribution).to(iec_context_menu_1.IecContextMenuContribution).inSingletonScope();
    // Signal Browser widget — left sidebar panel at rank 300
    bind(signal_browser_contribution_1.SignalBrowserContribution).toSelf().inSingletonScope();
    bind(browser_1.WidgetFactory).toService(signal_browser_contribution_1.SignalBrowserContribution);
    bind(browser_1.FrontendApplicationContribution).toService(signal_browser_contribution_1.SignalBrowserContribution);
    // Scope View widget — bottom panel at rank 500
    bind(scope_view_contribution_1.ScopeViewContribution).toSelf().inSingletonScope();
    bind(browser_1.WidgetFactory).toService(scope_view_contribution_1.ScopeViewContribution);
    bind(browser_1.FrontendApplicationContribution).toService(scope_view_contribution_1.ScopeViewContribution);
    // Signal Bridge RPC proxy — connects to backend native bridge
    bind(signal_bridge_protocol_1.SignalBridgeService).toDynamicValue(ctx => {
        const connection = ctx.container.get(browser_1.WebSocketConnectionProvider);
        return connection.createProxy(signal_bridge_protocol_1.SignalBridgeServicePath);
    }).inSingletonScope();
});
//# sourceMappingURL=audesys-core-frontend-module.js.map