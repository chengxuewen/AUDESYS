/**
 * AUDESYS Debug Panel — Browser Entry Point
 *
 * Exports the DI container module for Theia extension discovery.
 */
import frontendModule from './debug-frontend-module';
export default frontendModule;
export { AudesysDebugChannel } from './debug-channel';
export type { IDebugBridge } from './debug-channel';
export { AudesysDebugSession, AUDESYS_DEBUG_TYPE } from './debug-session';
export { AudesysDebugSessionContribution } from './debug-contribution';
export { DebugPanelWidget } from './debug-panel-widget';
export { VariablesViewWidget } from './variables-view';
export type { RegisterEntry } from './variables-view';
export { BreakpointsViewWidget } from './breakpoints-view';
//# sourceMappingURL=index.d.ts.map