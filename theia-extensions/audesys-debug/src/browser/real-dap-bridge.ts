/**
 * RealDapBridge — spawns the `audesys-dap-adapter` binary and drives it as a DAP
 * *client* over Content-Length framing. Maps each IDebugBridge method to the
 * adapter's DAP command surface (attach / pause / continue / next / variables /
 * setBreakpoints / stackTrace / disconnect).
 *
 * The adapter walks its own request/response protocol: every request carries a
 * sequential `seq`, and the response echoes it back as `request_seq`. We keep a
 * pending map seq → resolver so bridge Promises settle on the matching response.
 *
 * The adapter clears all breakpoints on every setBreakpoints call, so we mirror
 * the breakpoint set locally and always send the full remaining list.
 */
import { spawn, ChildProcess } from 'child_process';
import { encodeRequest, decodeFrames, DapFrame, DapResponse } from './dap-protocol';
import { IDebugBridge } from './debug-channel';

const DEFAULT_ADAPTER_PATH = 'target/debug/audesys-dap-adapter';

interface Pending {
    command: string;
    resolve: (frame: DapResponse) => void;
    reject: (reason: Error) => void;
}

export class RealDapBridge implements IDebugBridge {
    private proc: ChildProcess | null = null;
    private seq = 1;
    private pending = new Map<number, Pending>();
    private buf = '';
    private bps: number[] = [];
    private connected = false;

    private adapterPath: string;

    constructor(adapterPath?: string) {
        this.adapterPath = adapterPath ?? process.env.AUDESYS_DAP_ADAPTER ?? DEFAULT_ADAPTER_PATH;
    }

    async connect(socketPath: string, secret: string): Promise<string> {
        if (this.connected) {
            return 'ok';
        }
        const proc = spawn(this.adapterPath, [], { stdio: ['pipe', 'pipe', 'inherit'] });
        this.proc = proc;
        proc.stdout?.on('data', (chunk: Buffer) => this.onData(chunk.toString('utf8')));
        proc.on('exit', () => this.onExit());
        proc.on('error', (err) => this.rejectAll(err));

        // Adapter expects initialize before attach.
        await this.request('initialize', {
            adapterID: 'audesys',
            clientID: 'theia',
        });
        await this.request('attach', { socketPath, secret });
        this.connected = true;
        return 'ok';
    }

    async disconnect(): Promise<string> {
        if (this.connected) {
            await this.request('disconnect', {});
            this.connected = false;
        }
        this.kill();
        return 'ok';
    }

    async pause(): Promise<string> {
        await this.request('pause', {});
        return 'ok';
    }

    async resume(): Promise<string> {
        await this.request('continue', {});
        return 'ok';
    }

    async step(): Promise<string> {
        await this.request('next', {});
        return 'ok';
    }

    async getRegisters(): Promise<string> {
        const resp = await this.request('variables', { variablesReference: 1 });
        const list = asArray(resp?.body ? (resp.body as { variables?: unknown })?.variables : undefined);
        const pairs: Array<[string, string]> = list.map((v) => {
            const item = v as { name: string; value: string };
            return [item.name ?? '', item.value ?? ''];
        });
        return JSON.stringify(pairs);
    }

    async getBreakpoints(): Promise<string> {
        return JSON.stringify(this.bps);
    }

    async addBreakpoint(ip: number): Promise<string> {
        if (!this.bps.includes(ip)) {
            this.bps.push(ip);
        }
        await this.syncBreakpoints();
        return 'ok';
    }

    async removeBreakpoint(ip: number): Promise<string> {
        this.bps = this.bps.filter((b) => b !== ip);
        await this.syncBreakpoints();
        return 'ok';
    }

    async getState(): Promise<string> {
        const resp = await this.request('stackTrace', { threadId: 1 });
        const frames = asArray(resp?.body ? (resp.body as { stackFrames?: unknown })?.stackFrames : undefined);
        const first = frames[0] as { line?: unknown } | undefined;
        const currentIp = typeof first?.line === 'number' ? first.line : 0;
        return JSON.stringify({ current_ip: currentIp, breakpoints: this.bps });
    }

    // ── Internals ────────────────────────────────────────────────────────────

    private async syncBreakpoints(): Promise<void> {
        await this.request('setBreakpoints', {
            source: { name: 'main.st', path: 'main.st' },
            breakpoints: this.bps.map((line) => ({ line })),
        });
    }

    /** Send a DAP request and await its response. */
    private request(command: string, args?: object): Promise<DapResponse> {
        const proc = this.proc;
        if (!proc || proc.stdin === null || proc.stdin.destroyed) {
            return Promise.reject(new Error(`dap-adapter not running (${command})`));
        }
        const seq = this.seq++;
        return new Promise<DapResponse>((resolve, reject) => {
            this.pending.set(seq, { command, resolve, reject });
            proc.stdin!.write(encodeRequest(seq, command, args), (err) => {
                if (err) {
                    this.pending.delete(seq);
                    reject(err);
                }
            });
        });
    }

    private onData(chunk: string): void {
        this.buf += chunk;
        const { frames, rest } = decodeFrames(this.buf);
        this.buf = rest;
        for (const frame of frames) {
            this.onFrame(frame);
        }
    }

    private onFrame(frame: DapFrame): void {
        if (frame.type !== 'response') {
            return; // events are synthesized by debug-channel, ignore adapter events
        }
        const pending = this.pending.get(frame.request_seq);
        if (!pending) {
            return;
        }
        this.pending.delete(frame.request_seq);
        if (frame.success) {
            pending.resolve(frame);
        } else {
            pending.reject(new Error(`${pending.command}: ${frame.message ?? 'DAP error'}`));
        }
    }

    private onExit(): void {
        this.rejectAll(new Error('dap-adapter process exited'));
        this.connected = false;
        this.proc = null;
    }

    private rejectAll(reason: Error): void {
        for (const [, p] of this.pending) {
            p.reject(reason);
        }
        this.pending.clear();
    }

    private kill(): void {
        if (this.proc) {
            this.proc.kill();
            this.proc = null;
        }
    }
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

/** Resolve the configured adapter path (relative to the workspace root). */
export function resolveAdapterPath(baseDir: string): string {
    const env = process.env.AUDESYS_DAP_ADAPTER;
    if (env) {
        return env;
    }
    return `${baseDir}/${DEFAULT_ADAPTER_PATH}`;
}