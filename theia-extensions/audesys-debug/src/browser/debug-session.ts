/**
 * AUDESYS Debug Session — TheiaDebugSession subclass.
 *
 * Connects to an AUDESYS Controller via our custom DebugChannel,
 * providing DAP 12-command adapter for the Theia Debug UI.
 */

import { injectable, inject } from '@theia/core/shared/inversify';
import { DebugSession, DebugSessionData } from '@theia/debug/lib/browser/debug-session';
import { DebugSessionConnection } from '@theia/debug/lib/browser/debug-session-connection';
import { DebugConfigurationSessionOptions } from '@theia/debug/lib/browser/debug-session-options';
import { AudesysDebugChannel } from './debug-channel';

export const AUDESYS_DEBUG_TYPE = 'audesys';

@injectable()
export class AudesysDebugSession extends DebugSession {
    constructor(
        @inject(DebugSessionData) override readonly data: DebugSessionData,
        @inject(DebugSessionConnection) override readonly connection: DebugSessionConnection,
    ) {
        super();
    }

    static createChannel(options: DebugConfigurationSessionOptions): AudesysDebugChannel {
        const config = options.configuration;
        const socketPath = (typeof config.socketPath === 'string')
            ? config.socketPath
            : '/tmp/audesys-controller.sock';
        const secret = (typeof config.secret === 'string')
            ? config.secret
            : 'audesys-dev-secret';
        return new AudesysDebugChannel({ socketPath, secret });
    }
}
