import type { JsonRpcServer } from '@theia/core/lib/common/messaging';
import type { SignalBridgeService, SignalEntry } from '../common/signal-bridge-protocol';
/**
 * Backend implementation that wraps the napi-rs native bridge.
 *
 * Runs in Node.js main process where native modules are loadable.
 * Exposed to the frontend via Theia JSON-RPC.
 */
export declare class SignalBridgeServer implements JsonRpcServer<SignalBridgeService> {
    dispose(): void;
    setClient(_client: undefined): void;
    signalSnapshot(pattern: string): Promise<SignalEntry[]>;
}
//# sourceMappingURL=signal-bridge-service.d.ts.map