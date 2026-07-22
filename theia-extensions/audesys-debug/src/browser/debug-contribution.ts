/**
 * AUDESYS Debug Contribution — Registers the 'audesys' debug type in Theia.
 *
 * Provides default debug configurations and wires the AudesysDebugSession.
 */

import { injectable, inject } from '@theia/core/shared/inversify';
import { DebugConfiguration } from '@theia/debug/lib/common/debug-configuration';
import { DebugSessionContribution, DebugSessionFactory } from '@theia/debug/lib/browser/debug-session-contribution';
import { DebugSessionOptions } from '@theia/debug/lib/browser/debug-session-options';
import { DebugSession } from '@theia/debug/lib/browser/debug-session';
import { DebugSessionConnection } from '@theia/debug/lib/browser/debug-session-connection';
import { OutputChannelManager } from '@theia/output/lib/browser/output-channel';
import { AUDESYS_DEBUG_TYPE, AudesysDebugSession } from './debug-session';
import { AudesysDebugChannel } from './debug-channel';
import { Container } from '@theia/core/shared/inversify';
import { DebugSessionData } from '@theia/debug/lib/browser/debug-session';

@injectable()
export class AudesysDebugSessionContribution implements DebugSessionContribution {
    debugType = AUDESYS_DEBUG_TYPE;

    @inject(OutputChannelManager)
    protected readonly outputChannelManager!: OutputChannelManager;

    debugSessionFactory(): DebugSessionFactory {
        return new AudesysDebugSessionFactory();
    }
}

class AudesysDebugSessionFactory implements DebugSessionFactory {
    createSession(
        sessionId: string,
        options: DebugSessionOptions & { configuration: DebugConfiguration },
        parentSession?: DebugSession,
    ): DebugSession {
        const channel = AudesysDebugSession.createChannel(
            options as DebugSessionOptions & { configuration: DebugConfiguration },
        );

        const connection = new DebugSessionConnection(
            sessionId,
            () => Promise.resolve(channel),
            undefined,
        );

        const data: any = {
            id: sessionId,
            options,
            parentSession,
        };

        // pony-tail: manual DI instead of Inversify child container — the factory pattern
        // is simpler for a single session type. Use child container if >2 session types.
        const session = new DebugSessionImpl(data, connection);
        return session;
    }
}

/**
 * pony-tail: concrete DebugSession subclass to assign read-only injected fields.
 * AudesysDebugSession uses @inject which triggers Inversify — for manual construction
 * we create a plain subclass that assigns fields directly.
 */
class DebugSessionImpl extends AudesysDebugSession {
    constructor(data: any, connection: DebugSessionConnection) {
        // Bypass Inversify — assign fields directly via prototype
        super(data as any, connection as any);
        // Override readonly fields via Object.defineProperty
        Object.defineProperty(this, 'data', { value: data, writable: false });
        Object.defineProperty(this, 'connection', { value: connection, writable: false });
    }
}
