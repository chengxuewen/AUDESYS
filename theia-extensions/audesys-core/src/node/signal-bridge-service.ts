import { injectable } from '@theia/core/shared/inversify';
import type { JsonRpcServer } from '@theia/core/lib/common/messaging';
import type { SignalBridgeService, SignalEntry } from '../common/signal-bridge-protocol';

/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const bridge = require('@audesys/theia-bridge');

/**
 * Backend implementation that wraps the napi-rs native bridge.
 *
 * Runs in Node.js main process where native modules are loadable.
 * Exposed to the frontend via Theia JSON-RPC.
 */
@injectable()
export class SignalBridgeServer implements JsonRpcServer<SignalBridgeService> {
    dispose(): void {
        // no-op: bridge is stateless, no cleanup needed
    }

    setClient(_client: undefined): void {
        // no-op: bridge calls are one-shot, no push notifications yet
    }

    async signalSnapshot(pattern: string): Promise<SignalEntry[]> {
        // ponytail: synchronous native call, no need for worker pool at this scale
        const raw: string = bridge.signalSnapshot(pattern);
        return JSON.parse(raw) as SignalEntry[];
    }
}
