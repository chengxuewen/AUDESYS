/**
 * In-process DebugChannel that maps 12 DAP commands to Controller debug bridge.
 *
 * Phase 1 uses an IDebugBridge stub (simulated responses) so Theia Debug UI
 * renders correctly without a live Controller.
 * P2: swap bridge for napi-rs native addon when crate stubs are filled.
 */

import { DebugChannel } from '@theia/debug/lib/common/debug-service';

// ── Bridge interface ─────────────────────────────────────────────────────

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

// ── Stub bridge for Phase 1 ──────────────────────────────────────────────
// ponytail: realistic defaults so the Theia Debug UI renders correctly.
// Swap for napi-rs native addon when crate stubs are filled in P2.

class StubDebugBridge implements IDebugBridge {
    private bps: number[] = [];

    async connect(_socketPath: string, _secret: string): Promise<string> { return 'ok'; }
    async disconnect(): Promise<string> { return 'ok'; }
    async pause(): Promise<string> { return 'ok'; }
    async resume(): Promise<string> { return 'ok'; }
    async step(): Promise<string> { return 'ok'; }
    async getRegisters(): Promise<string> {
        return JSON.stringify([
            ['r0','0x00000000'],['r1','0x00000000'],['r2','0x00000000'],['r3','0x00000000'],
            ['r4','0x00000000'],['r5','0x00000000'],['r6','0x00000000'],['r7','0x00000000'],
            ['r8','0x00000000'],['r9','0x00000000'],['r10','0x00000000'],['r11','0x00000000'],
            ['r12','0x00000000'],['r13','0x00000000'],
        ]);
    }
    async getBreakpoints(): Promise<string> { return JSON.stringify(this.bps); }
    async addBreakpoint(ip: number): Promise<string> { this.bps.push(ip); return 'ok'; }
    async removeBreakpoint(ip: number): Promise<string> {
        this.bps = this.bps.filter(b => b !== ip);
        return 'ok';
    }
    async getState(): Promise<string> {
        return JSON.stringify({ current_ip: 0, breakpoints: this.bps });
    }
}

// ── DebugChannel implementation ──────────────────────────────────────────

type MessageCallback = (message: string) => void;

export class AudesysDebugChannel implements DebugChannel {
    private onMsgCb: MessageCallback | null = null;
    private onErrCb: ((reason: unknown) => void) | null = null;
    private onCloseCb: ((code: number, reason: string) => void) | null = null;
    private seq = 1;
    private connected = false;
    private bridge: IDebugBridge;

    constructor(
        private readonly options: { socketPath: string; secret: string },
        bridge?: IDebugBridge,
    ) {
        this.bridge = bridge ?? new StubDebugBridge();
    }

    onMessage(cb: MessageCallback): void { this.onMsgCb = cb; }
    onError(cb: (reason: unknown) => void): void { this.onErrCb = cb; }
    onClose(cb: (code: number, reason: string) => void): void { this.onCloseCb = cb; }

    send(content: string): void {
        try {
            const req = JSON.parse(content) as DapRequest;
            this.dispatch(req);
        } catch (e) {
            if (this.onErrCb) this.onErrCb(e);
        }
    }

    close(): void {
        if (this.connected) {
            this.bridge.disconnect().catch(() => { /* ignore */ });
            this.connected = false;
        }
        if (this.onCloseCb) this.onCloseCb(0, 'user');
    }

    // ── Command dispatch ─────────────────────────────────────────────────

    private async dispatch(req: DapRequest): Promise<void> {
        const { command, seq: requestSeq, arguments: args } = req;
        try {
            switch (command) {
                case 'initialize':
                    this.respond(requestSeq, command, {
                        supportsConfigurationDoneRequest: true,
                        supportsConditionalBreakpoints: false,
                        supportsStepInTargetsRequest: false,
                        supportsStepBack: false,
                        supportsGotoTargetsRequest: false,
                    });
                    this.event('initialized', {});
                    break;
                case 'launch':
                case 'attach':
                    await this.bridge.connect(this.options.socketPath, this.options.secret);
                    this.connected = true;
                    await this.bridge.pause();
                    this.respond(requestSeq, command, {});
                    this.event('stopped', { reason: 'entry', threadId: 1, allThreadsStopped: true });
                    break;
                case 'setBreakpoints':
                    await this.handleSetBreakpoints(requestSeq, command, args);
                    break;
                case 'configurationDone':
                    this.respond(requestSeq, command, {});
                    break;
                case 'continue':
                    await this.bridge.resume();
                    this.respond(requestSeq, command, { allThreadsContinued: true });
                    this.event('continued', { threadId: 1, allThreadsContinued: true });
                    break;
                case 'next':
                case 'stepIn':
                    await this.bridge.step();
                    this.respond(requestSeq, command, {});
                    this.event('stopped', { reason: 'step', threadId: 1, allThreadsStopped: true });
                    break;
                case 'pause':
                    await this.bridge.pause();
                    this.respond(requestSeq, command, {});
                    this.event('stopped', { reason: 'pause', threadId: 1, allThreadsStopped: true });
                    break;
                case 'threads':
                    this.respond(requestSeq, command, { threads: [{ id: 1, name: 'main' }] });
                    break;
                case 'stackTrace':
                    await this.handleStackTrace(requestSeq, command);
                    break;
                case 'scopes':
                    this.respond(requestSeq, command, {
                        scopes: [{ name: 'Registers', variablesReference: 1, expensive: false }],
                    });
                    break;
                case 'variables':
                    await this.handleVariables(requestSeq, command);
                    break;
                case 'disconnect':
                    await this.bridge.disconnect();
                    this.connected = false;
                    this.respond(requestSeq, command, {});
                    break;
                default:
                    this.err(requestSeq, command, `unsupported: ${command}`);
            }
        } catch (e) {
            this.err(requestSeq, command, `${command}: ${e}`);
        }
    }

    private async handleSetBreakpoints(requestSeq: number, command: string, args: unknown): Promise<void> {
        const existingBps = JSON.parse(await this.bridge.getBreakpoints()) as number[];
        for (const ip of existingBps) {
            await this.bridge.removeBreakpoint(ip);
        }
        const bpArgs = args as { breakpoints?: { line: number }[] } | undefined;
        const bps = bpArgs?.breakpoints ?? [];
        const result = [];
        for (let i = 0; i < bps.length; i++) {
            try {
                await this.bridge.addBreakpoint(bps[i].line);
                result.push({ id: i + 1, verified: true, line: bps[i].line });
            } catch (e) {
                result.push({ id: i + 1, verified: false, line: bps[i].line, message: String(e) });
            }
        }
        this.respond(requestSeq, command, { breakpoints: result });
    }

    private async handleStackTrace(requestSeq: number, command: string): Promise<void> {
        const state = await this.bridge.getState();
        const parsed = JSON.parse(state);
        const ip: number = typeof parsed.current_ip === 'number' ? parsed.current_ip : 0;
        this.respond(requestSeq, command, {
            stackFrames: [{
                id: 0,
                name: 'ST Program',
                line: ip,
                column: 0,
                source: { name: 'main.st' },
                instructionPointerReference: `0x${ip.toString(16).toUpperCase()}`,
            }],
            totalFrames: 1,
        });
    }

    private async handleVariables(requestSeq: number, command: string): Promise<void> {
        const regsJson = await this.bridge.getRegisters();
        const regPairs = JSON.parse(regsJson) as [string, string][];
        const variables = regPairs.map(([name, value]) => ({
            name,
            value,
            variablesReference: 0,
        }));
        this.respond(requestSeq, command, { variables });
    }

    // ── Protocol helpers ──────────────────────────────────────────────────

    private respond(requestSeq: number, command: string, body: unknown): void {
        this.emit(JSON.stringify({ seq: this.seq++, type: 'response', request_seq: requestSeq, success: true, command, body }));
    }

    private err(requestSeq: number, command: string, message: string): void {
        this.emit(JSON.stringify({ seq: this.seq++, type: 'response', request_seq: requestSeq, success: false, command, message }));
    }

    private event(event: string, body: unknown): void {
        this.emit(JSON.stringify({ seq: this.seq++, type: 'event', event, body }));
    }

    private emit(msg: string): void {
        if (this.onMsgCb) this.onMsgCb(msg);
    }
}

interface DapRequest {
    seq: number;
    command: string;
    arguments?: unknown;
}
