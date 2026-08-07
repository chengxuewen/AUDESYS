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
const pou_wizard_contribution_1 = require("./pou-wizard-contribution");
const iec_context_menu_1 = require("./iec-context-menu");
const open_folder_menu_1 = require("./open-folder-menu");
const window_title_contribution_1 = require("./window-title-contribution");
const signal_browser_contribution_1 = require("./signal-browser/signal-browser-contribution");
const scope_view_contribution_1 = require("./scope-view/scope-view-contribution");
const pou_tree_contribution_1 = require("./pou-view/pou-tree-contribution");
const gvl_view_contribution_1 = require("./gvl-view/gvl-view-contribution");
const local_var_view_contribution_1 = require("./local-var-view/local-var-view-contribution");
const signal_bridge_protocol_1 = require("../common/signal-bridge-protocol");
exports.default = new inversify_1.ContainerModule((bind) => {
    // IEC 61131-3 navigator decorator — appends [Program]/[HMI]/[CNC] labels
    bind(label_provider_1.LabelProviderContribution).to(iec_navigator_decorator_1.IecNavigatorDecorator).inSingletonScope();
    // IEC 61131-3 file icon theme
    bind(icon_theme_contribution_1.IconThemeContribution).to(iec_icons_1.IecFileIconTheme).inSingletonScope();
    // New File wizard entries for IEC languages + HMI + CNC
    bind(common_1.CommandContribution).to(iec_new_file_contribution_1.IecNewFileContribution).inSingletonScope();
    bind(common_1.MenuContribution).to(iec_new_file_contribution_1.IecNewFileContribution).inSingletonScope();
    // New POU wizard (A1-4) — type + language → templated file in right dir
    bind(common_1.CommandContribution).to(pou_wizard_contribution_1.PouWizardContribution).inSingletonScope();
    bind(common_1.MenuContribution).to(pou_wizard_contribution_1.PouWizardContribution).inSingletonScope();
    // Context menu: Compile / Deploy / Validate (right-click in navigator)
    bind(common_1.CommandContribution).to(iec_context_menu_1.IecContextMenuContribution).inSingletonScope();
    bind(common_1.MenuContribution).to(iec_context_menu_1.IecContextMenuContribution).inSingletonScope();
    // Open Folder menu entry — Theia hides it on macOS/browser mode
    bind(common_1.CommandContribution).to(open_folder_menu_1.OpenFolderMenuContribution).inSingletonScope();
    bind(common_1.MenuContribution).to(open_folder_menu_1.OpenFolderMenuContribution).inSingletonScope();
    // Signal Browser widget — left sidebar panel at rank 300
    bind(signal_browser_contribution_1.SignalBrowserContribution).toSelf().inSingletonScope();
    bind(browser_1.WidgetFactory).toService(signal_browser_contribution_1.SignalBrowserContribution);
    bind(browser_1.FrontendApplicationContribution).toService(signal_browser_contribution_1.SignalBrowserContribution);
    // Scope View widget — bottom panel at rank 500
    bind(scope_view_contribution_1.ScopeViewContribution).toSelf().inSingletonScope();
    bind(browser_1.WidgetFactory).toService(scope_view_contribution_1.ScopeViewContribution);
    bind(browser_1.FrontendApplicationContribution).toService(scope_view_contribution_1.ScopeViewContribution);
    // POU tree widget — IEC 61131-3 grouping in left sidebar at rank 250
    bind(pou_tree_contribution_1.PouTreeContribution).toSelf().inSingletonScope();
    bind(browser_1.WidgetFactory).toService(pou_tree_contribution_1.PouTreeContribution);
    bind(browser_1.FrontendApplicationContribution).toService(pou_tree_contribution_1.PouTreeContribution);
    // GVL Variables panel — table editor for the active .gvl file (left area, rank 240)
    bind(gvl_view_contribution_1.GvlViewContribution).toSelf().inSingletonScope();
    bind(browser_1.WidgetFactory).toService(gvl_view_contribution_1.GvlViewContribution);
    bind(browser_1.FrontendApplicationContribution).toService(gvl_view_contribution_1.GvlViewContribution);
    // Local Variables panel — table editor for the active .st/.il VAR block (left area, rank 230)
    bind(local_var_view_contribution_1.LocalVarViewContribution).toSelf().inSingletonScope();
    bind(browser_1.WidgetFactory).toService(local_var_view_contribution_1.LocalVarViewContribution);
    bind(browser_1.FrontendApplicationContribution).toService(local_var_view_contribution_1.LocalVarViewContribution);
    // Window title — always show "AUDESYS Studio" regardless of workspace folder
    bind(window_title_contribution_1.WindowTitleContribution).toSelf().inSingletonScope();
    bind(browser_1.FrontendApplicationContribution).toService(window_title_contribution_1.WindowTitleContribution);
    // Signal Bridge RPC proxy — connects to backend native bridge.
    // Signal Bridge RPC proxy — connects to backend native bridge.
    // ponytail: fallback stub prevents crash when backend isn't ready during init.
    // Use toDynamicValue for lazy resolution; createProxy is deferred until first inject.
    bind(signal_bridge_protocol_1.SignalBridgeService).toDynamicValue(ctx => {
        const connection = ctx.container.get(browser_1.WebSocketConnectionProvider);
        return connection.createProxy(signal_bridge_protocol_1.SignalBridgeServicePath);
    }).inSingletonScope();
});
//# sourceMappingURL=audesys-core-frontend-module.js.map