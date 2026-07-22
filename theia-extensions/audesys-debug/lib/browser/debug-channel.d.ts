/**
 * In-process DebugChannel that maps 12 DAP commands to Controller debug bridge.
 *
 * Phase 1 uses an IDebugBridge stub (simulated responses) so Theia Debug UI
 * renders correctly without a live Controller.
 * P2: swap bridge for napi-rs native addon when crate stubs are filled.
 */
import { DebugChannel } from '@theia/debug/lib/common/debug-service';
export interface IDebugBridge {
    connect(socketPath: string, secret: string): Promise<string>;
    disconnect(): Promise<string>;
    pause(): Promise<string>;
    resume(): Promise<string>;
    step(): Promise<string>;
    getRegisters(): Promise<string>;
    getBreakpoints(): Promise<string>;
    addBreakpoint(ip: number): Promise<string>;
    removeBreakpoint(ip: number): Promise<string>;
    getState(): Promise<string>;
}
type MessageCallback = (message: string) => void;
export declare class AudesysDebugChannel implements DebugChannel {
    private readonly options;
    private onMsgCb;
    private onErrCb;
    private onCloseCb;
    private seq;
    private connected;
    private bridge;
    constructor(options: {
        socketPath: string;
        secret: string;
    }, bridge?: IDebugBridge);
    onMessage(cb: MessageCallback): void;
    onError(cb: (reason: unknown) => void): void;
    onClose(cb: (code: number, reason: string) => void): void;
    send(content: string): void;
    close(): void;
    private dispatch;
    private handleSetBreakpoints;
    private handleStackTrace;
    private handleVariables;
    private respond;
    private err;
    private event;
    private emit;
}
export {};
//# sourceMappingURL=debug-channel.d.ts.map