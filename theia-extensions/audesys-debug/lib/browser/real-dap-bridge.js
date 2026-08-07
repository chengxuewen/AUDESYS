"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealDapBridge = void 0;
exports.resolveAdapterPath = resolveAdapterPath;
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
const child_process_1 = require("child_process");
const dap_protocol_1 = require("./dap-protocol");
const DEFAULT_ADAPTER_PATH = 'target/debug/audesys-dap-adapter';
class RealDapBridge {
    constructor(adapterPath) {
        this.proc = null;
        this.seq = 1;
        this.pending = new Map();
        this.buf = '';
        this.bps = [];
        this.connected = false;
        this.adapterPath = adapterPath ?? process.env.AUDESYS_DAP_ADAPTER ?? DEFAULT_ADAPTER_PATH;
    }
    async connect(socketPath, secret) {
        if (this.connected) {
            return 'ok';
        }
        const proc = (0, child_process_1.spawn)(this.adapterPath, [], { stdio: ['pipe', 'pipe', 'inherit'] });
        this.proc = proc;
        proc.stdout?.on('data', (chunk) => this.onData(chunk.toString('utf8')));
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
    async disconnect() {
        if (this.connected) {
            await this.request('disconnect', {});
            this.connected = false;
        }
        this.kill();
        return 'ok';
    }
    async pause() {
        await this.request('pause', {});
        return 'ok';
    }
    async resume() {
        await this.request('continue', {});
        return 'ok';
    }
    async step() {
        await this.request('next', {});
        return 'ok';
    }
    async getRegisters() {
        const resp = await this.request('variables', { variablesReference: 1 });
        const list = asArray(resp?.body ? resp.body?.variables : undefined);
        const pairs = list.map((v) => {
            const item = v;
            return [item.name ?? '', item.value ?? ''];
        });
        return JSON.stringify(pairs);
    }
    async getBreakpoints() {
        return JSON.stringify(this.bps);
    }
    async addBreakpoint(ip) {
        if (!this.bps.includes(ip)) {
            this.bps.push(ip);
        }
        await this.syncBreakpoints();
        return 'ok';
    }
    async removeBreakpoint(ip) {
        this.bps = this.bps.filter((b) => b !== ip);
        await this.syncBreakpoints();
        return 'ok';
    }
    async getState() {
        const resp = await this.request('stackTrace', { threadId: 1 });
        const frames = asArray(resp?.body ? resp.body?.stackFrames : undefined);
        const first = frames[0];
        const currentIp = typeof first?.line === 'number' ? first.line : 0;
        return JSON.stringify({ current_ip: currentIp, breakpoints: this.bps });
    }
    // ── Internals ────────────────────────────────────────────────────────────
    async syncBreakpoints() {
        await this.request('setBreakpoints', {
            source: { name: 'main.st', path: 'main.st' },
            breakpoints: this.bps.map((line) => ({ line })),
        });
    }
    /** Send a DAP request and await its response. */
    request(command, args) {
        const proc = this.proc;
        if (!proc || proc.stdin === null || proc.stdin.destroyed) {
            return Promise.reject(new Error(`dap-adapter not running (${command})`));
        }
        const seq = this.seq++;
        return new Promise((resolve, reject) => {
            this.pending.set(seq, { command, resolve, reject });
            proc.stdin.write((0, dap_protocol_1.encodeRequest)(seq, command, args), (err) => {
                if (err) {
                    this.pending.delete(seq);
                    reject(err);
                }
            });
        });
    }
    onData(chunk) {
        this.buf += chunk;
        const { frames, rest } = (0, dap_protocol_1.decodeFrames)(this.buf);
        this.buf = rest;
        for (const frame of frames) {
            this.onFrame(frame);
        }
    }
    onFrame(frame) {
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
        }
        else {
            pending.reject(new Error(`${pending.command}: ${frame.message ?? 'DAP error'}`));
        }
    }
    onExit() {
        this.rejectAll(new Error('dap-adapter process exited'));
        this.connected = false;
        this.proc = null;
    }
    rejectAll(reason) {
        for (const [, p] of this.pending) {
            p.reject(reason);
        }
        this.pending.clear();
    }
    kill() {
        if (this.proc) {
            this.proc.kill();
            this.proc = null;
        }
    }
}
exports.RealDapBridge = RealDapBridge;
function asArray(value) {
    return Array.isArray(value) ? value : [];
}
/** Resolve the configured adapter path (relative to the workspace root). */
function resolveAdapterPath(baseDir) {
    const env = process.env.AUDESYS_DAP_ADAPTER;
    if (env) {
        return env;
    }
    return `${baseDir}/${DEFAULT_ADAPTER_PATH}`;
}
//# sourceMappingURL=real-dap-bridge.js.map