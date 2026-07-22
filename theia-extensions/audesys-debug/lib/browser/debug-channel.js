"use strict";
/**
 * In-process DebugChannel that maps 12 DAP commands to Controller debug bridge.
 *
 * Phase 1 uses an IDebugBridge stub (simulated responses) so Theia Debug UI
 * renders correctly without a live Controller.
 * P2: swap bridge for napi-rs native addon when crate stubs are filled.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudesysDebugChannel = void 0;
// ── Stub bridge for Phase 1 ──────────────────────────────────────────────
// ponytail: realistic defaults so the Theia Debug UI renders correctly.
// Swap for napi-rs native addon when crate stubs are filled in P2.
class StubDebugBridge {
    constructor() {
        this.bps = [];
    }
    async connect(_socketPath, _secret) { return 'ok'; }
    async disconnect() { return 'ok'; }
    async pause() { return 'ok'; }
    async resume() { return 'ok'; }
    async step() { return 'ok'; }
    async getRegisters() {
        return JSON.stringify([
            ['r0', '0x00000000'], ['r1', '0x00000000'], ['r2', '0x00000000'], ['r3', '0x00000000'],
            ['r4', '0x00000000'], ['r5', '0x00000000'], ['r6', '0x00000000'], ['r7', '0x00000000'],
            ['r8', '0x00000000'], ['r9', '0x00000000'], ['r10', '0x00000000'], ['r11', '0x00000000'],
            ['r12', '0x00000000'], ['r13', '0x00000000'],
        ]);
    }
    async getBreakpoints() { return JSON.stringify(this.bps); }
    async addBreakpoint(ip) { this.bps.push(ip); return 'ok'; }
    async removeBreakpoint(ip) {
        this.bps = this.bps.filter(b => b !== ip);
        return 'ok';
    }
    async getState() {
        return JSON.stringify({ current_ip: 0, breakpoints: this.bps });
    }
}
class AudesysDebugChannel {
    constructor(options, bridge) {
        this.options = options;
        this.onMsgCb = null;
        this.onErrCb = null;
        this.onCloseCb = null;
        this.seq = 1;
        this.connected = false;
        this.bridge = bridge ?? new StubDebugBridge();
    }
    onMessage(cb) { this.onMsgCb = cb; }
    onError(cb) { this.onErrCb = cb; }
    onClose(cb) { this.onCloseCb = cb; }
    send(content) {
        try {
            const req = JSON.parse(content);
            this.dispatch(req);
        }
        catch (e) {
            if (this.onErrCb)
                this.onErrCb(e);
        }
    }
    close() {
        if (this.connected) {
            this.bridge.disconnect().catch(() => { });
            this.connected = false;
        }
        if (this.onCloseCb)
            this.onCloseCb(0, 'user');
    }
    // ── Command dispatch ─────────────────────────────────────────────────
    async dispatch(req) {
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
        }
        catch (e) {
            this.err(requestSeq, command, `${command}: ${e}`);
        }
    }
    async handleSetBreakpoints(requestSeq, command, args) {
        const existingBps = JSON.parse(await this.bridge.getBreakpoints());
        for (const ip of existingBps) {
            await this.bridge.removeBreakpoint(ip);
        }
        const bpArgs = args;
        const bps = bpArgs?.breakpoints ?? [];
        const result = [];
        for (let i = 0; i < bps.length; i++) {
            try {
                await this.bridge.addBreakpoint(bps[i].line);
                result.push({ id: i + 1, verified: true, line: bps[i].line });
            }
            catch (e) {
                result.push({ id: i + 1, verified: false, line: bps[i].line, message: String(e) });
            }
        }
        this.respond(requestSeq, command, { breakpoints: result });
    }
    async handleStackTrace(requestSeq, command) {
        const state = await this.bridge.getState();
        const parsed = JSON.parse(state);
        const ip = typeof parsed.current_ip === 'number' ? parsed.current_ip : 0;
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
    async handleVariables(requestSeq, command) {
        const regsJson = await this.bridge.getRegisters();
        const regPairs = JSON.parse(regsJson);
        const variables = regPairs.map(([name, value]) => ({
            name,
            value,
            variablesReference: 0,
        }));
        this.respond(requestSeq, command, { variables });
    }
    // ── Protocol helpers ──────────────────────────────────────────────────
    respond(requestSeq, command, body) {
        this.emit(JSON.stringify({ seq: this.seq++, type: 'response', request_seq: requestSeq, success: true, command, body }));
    }
    err(requestSeq, command, message) {
        this.emit(JSON.stringify({ seq: this.seq++, type: 'response', request_seq: requestSeq, success: false, command, message }));
    }
    event(event, body) {
        this.emit(JSON.stringify({ seq: this.seq++, type: 'event', event, body }));
    }
    emit(msg) {
        if (this.onMsgCb)
            this.onMsgCb(msg);
    }
}
exports.AudesysDebugChannel = AudesysDebugChannel;
//# sourceMappingURL=debug-channel.js.map