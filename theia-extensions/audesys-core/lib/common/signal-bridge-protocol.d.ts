/**
 * RPC protocol for the Signal Bridge service.
 *
 * The backend wraps @audesys/theia-bridge native bindings.
 * The frontend receives a proxy via WebSocketConnectionProvider.
 */
export interface SignalEntry {
    name: string;
    value: string;
}
export declare const SignalBridgeService: unique symbol;
export interface SignalBridgeService {
    signalSnapshot(pattern: string): Promise<SignalEntry[]>;
}
export declare const SignalBridgeServicePath = "/services/audesys-signal-bridge";
//# sourceMappingURL=signal-bridge-protocol.d.ts.map