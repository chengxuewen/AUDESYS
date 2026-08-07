import { IDebugBridge } from './debug-channel';
export declare class RealDapBridge implements IDebugBridge {
    private proc;
    private seq;
    private pending;
    private buf;
    private bps;
    private connected;
    private adapterPath;
    constructor(adapterPath?: string);
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
    private syncBreakpoints;
    /** Send a DAP request and await its response. */
    private request;
    private onData;
    private onFrame;
    private onExit;
    private rejectAll;
    private kill;
}
/** Resolve the configured adapter path (relative to the workspace root). */
export declare function resolveAdapterPath(baseDir: string): string;
//# sourceMappingURL=real-dap-bridge.d.ts.map