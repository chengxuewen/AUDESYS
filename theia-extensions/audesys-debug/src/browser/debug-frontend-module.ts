/**
 * AUDESYS Debug Frontend Module — Theia DI bindings.
 *
 * Registers:
 *   - DebugSessionContribution for 'audesys' debug type
 *   - DebugPanelWidget as a bottom panel
 *   - VariablesViewWidget for register inspection
 *   - BreakpointsViewWidget for breakpoint management
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { WidgetFactory } from '@theia/core/lib/browser';
import { DebugSessionContribution } from '@theia/debug/lib/browser/debug-session-contribution';
import { AudesysDebugSessionContribution } from './debug-contribution';
import { DebugPanelWidget } from './debug-panel-widget';
import { VariablesViewWidget } from './variables-view';
import { BreakpointsViewWidget } from './breakpoints-view';

export default new ContainerModule((bind) => {
    // Debug adapter contribution
    bind(DebugSessionContribution).to(AudesysDebugSessionContribution).inSingletonScope();

    // Bottom panel widgets
    bind(DebugPanelWidget).toSelf().inSingletonScope();
    bind(WidgetFactory).toDynamicValue((ctx) => ({
        id: DebugPanelWidget.ID,
        createWidget: () => ctx.container.get(DebugPanelWidget),
    })).inSingletonScope();

    bind(VariablesViewWidget).toSelf().inSingletonScope();
    bind(WidgetFactory).toDynamicValue((ctx) => ({
        id: VariablesViewWidget.ID,
        createWidget: () => ctx.container.get(VariablesViewWidget),
    })).inSingletonScope();

    bind(BreakpointsViewWidget).toSelf().inSingletonScope();
    bind(WidgetFactory).toDynamicValue((ctx) => ({
        id: BreakpointsViewWidget.ID,
        createWidget: () => ctx.container.get(BreakpointsViewWidget),
    })).inSingletonScope();
});
