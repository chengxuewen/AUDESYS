import { ContainerModule } from '@theia/core/shared/inversify';
import { LabelProviderContribution } from '@theia/core/lib/browser/label-provider';
import { IconThemeContribution } from '@theia/core/lib/browser/icon-theme-contribution';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { WebSocketConnectionProvider, WidgetFactory, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { IecNavigatorDecorator } from './iec-navigator-decorator';
import { IecFileIconTheme } from './iec-icons';
// [DISABLED - requires @theia/workspace async init] import { IecNewFileContribution } from './iec-new-file-contribution';
import { IecContextMenuContribution } from './iec-context-menu';
import { SignalBrowserContribution } from './signal-browser/signal-browser-contribution';
import { ScopeViewContribution } from './scope-view/scope-view-contribution';
import { SignalBridgeService, SignalBridgeServicePath } from '../common/signal-bridge-protocol';

export default new ContainerModule((bind) => {
    // IEC 61131-3 navigator decorator — appends [Program]/[HMI]/[CNC] labels
    bind(LabelProviderContribution).to(IecNavigatorDecorator).inSingletonScope();

    // IEC 61131-3 file icon theme
    bind(IconThemeContribution).to(IecFileIconTheme).inSingletonScope();

    // New File wizard entries for IEC languages + HMI + CNC
// [DISABLED - requires @theia/workspace async init]     bind(CommandContribution).to(IecNewFileContribution).inSingletonScope();
// [DISABLED - requires @theia/workspace async init]     bind(MenuContribution).to(IecNewFileContribution).inSingletonScope();

    // Context menu: Compile / Deploy / Validate (right-click in navigator)
    bind(CommandContribution).to(IecContextMenuContribution).inSingletonScope();
    bind(MenuContribution).to(IecContextMenuContribution).inSingletonScope();

    // Signal Browser widget — left sidebar panel at rank 300
    bind(SignalBrowserContribution).toSelf().inSingletonScope();
    bind(WidgetFactory).toService(SignalBrowserContribution);
    bind(FrontendApplicationContribution).toService(SignalBrowserContribution);

    // Scope View widget — bottom panel at rank 500
    bind(ScopeViewContribution).toSelf().inSingletonScope();
    bind(WidgetFactory).toService(ScopeViewContribution);
    bind(FrontendApplicationContribution).toService(ScopeViewContribution);

    // Signal Bridge RPC proxy — connects to backend native bridge.
    // ponytail: fallback stub prevents crash when backend isn't ready during init.
    // Use toDynamicValue for lazy resolution; createProxy is deferred until first inject.
    bind(SignalBridgeService).toDynamicValue(ctx => {
        const connection = ctx.container.get(WebSocketConnectionProvider);
        return connection.createProxy<SignalBridgeService>(SignalBridgeServicePath);
    }).inSingletonScope();
});
