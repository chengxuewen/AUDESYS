/**
 * AUDESYS Debug Session — TheiaDebugSession subclass.
 *
 * Connects to an AUDESYS Controller via our custom DebugChannel,
 * providing DAP 12-command adapter for the Theia Debug UI.
 */
import { DebugSession, DebugSessionData } from '@theia/debug/lib/browser/debug-session';
import { DebugSessionConnection } from '@theia/debug/lib/browser/debug-session-connection';
import { DebugConfigurationSessionOptions } from '@theia/debug/lib/browser/debug-session-options';
import { AudesysDebugChannel } from './debug-channel';
export declare const AUDESYS_DEBUG_TYPE = "audesys";
export declare class AudesysDebugSession extends DebugSession {
    readonly data: DebugSessionData;
    readonly connection: DebugSessionConnection;
    constructor(data: DebugSessionData, connection: DebugSessionConnection);
    static createChannel(options: DebugConfigurationSessionOptions): AudesysDebugChannel;
}
//# sourceMappingURL=debug-session.d.ts.map