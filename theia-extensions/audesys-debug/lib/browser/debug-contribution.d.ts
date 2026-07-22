/**
 * AUDESYS Debug Contribution — Registers the 'audesys' debug type in Theia.
 *
 * Provides default debug configurations and wires the AudesysDebugSession.
 */
import { DebugSessionContribution, DebugSessionFactory } from '@theia/debug/lib/browser/debug-session-contribution';
import { OutputChannelManager } from '@theia/output/lib/browser/output-channel';
export declare class AudesysDebugSessionContribution implements DebugSessionContribution {
    debugType: string;
    protected readonly outputChannelManager: OutputChannelManager;
    debugSessionFactory(): DebugSessionFactory;
}
//# sourceMappingURL=debug-contribution.d.ts.map