"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const debug_channel_1 = require("../browser/debug-channel");
class MockBridge {
    constructor() {
        this.calls = [];
        this.currentIp = 0;
        this.breakpoints = [];
    }
    async connect(_socketPath, _secret) {
        this.calls.push({ method: 'connect', args: [_socketPath, _secret] });
        return 'ok';
    }
    async disconnect() {
        this.calls.push({ method: 'disconnect', args: [] });
        return 'ok';
    }
    async pause() {
        this.calls.push({ method: 'pause', args: [] });
        return 'ok';
    }
    async resume() {
        this.calls.push({ method: 'resume', args: [] });
        return 'ok';
    }
    async step() {
        this.calls.push({ method: 'step', args: [] });
        return 'ok';
    }
    async getRegisters() {
        this.calls.push({ method: 'getRegisters', args: [] });
        return JSON.stringify([['r0', '0x00000001'], ['r1', '0x00000002']]);
    }
    async getBreakpoints() {
        this.calls.push({ method: 'getBreakpoints', args: [] });
        return JSON.stringify(this.breakpoints);
    }
    async addBreakpoint(ip) {
        this.calls.push({ method: 'addBreakpoint', args: [ip] });
        this.breakpoints.push(ip);
        return 'ok';
    }
    async removeBreakpoint(ip) {
        this.calls.push({ method: 'removeBreakpoint', args: [ip] });
        this.breakpoints = this.breakpoints.filter((b) => b !== ip);
        return 'ok';
    }
    async getState() {
        this.calls.push({ method: 'getState', args: [] });
        return JSON.stringify({ current_ip: this.currentIp, breakpoints: this.breakpoints });
    }
    setIp(ip) {
        this.currentIp = ip;
    }
}
function makeChannel(bridge) {
    const b = bridge ?? new MockBridge();
    const msgs = [];
    const errs = [];
    const closes = [];
    const ch = new debug_channel_1.AudesysDebugChannel({ socketPath: '/tmp/test.sock', secret: 'test-secret' }, b);
    ch.onMessage((m) => msgs.push(m));
    ch.onError((e) => errs.push(e));
    ch.onClose((code, reason) => closes.push({ code, reason }));
    return { channel: ch, bridge: b, messages: msgs, errors: errs, closeEvents: closes };
}
function send(channel, command, args, seq) {
    channel.send(JSON.stringify({ seq: seq ?? 1, command, arguments: args }));
}
// send() fires async dispatch() without await; flush lets microtasks settle
const flush = () => new Promise((r) => setTimeout(r, 50));
function findResponse(msgs, command) {
    for (const m of msgs) {
        const parsed = JSON.parse(m);
        if (parsed.type === 'response' && parsed.command === command) {
            return parsed;
        }
    }
    return undefined;
}
(0, vitest_1.describe)('AudesysDebugChannel', () => {
    let channel;
    let bridge;
    let messages;
    let closeEvents;
    (0, vitest_1.beforeEach)(() => {
        const m = makeChannel();
        channel = m.channel;
        bridge = m.bridge;
        messages = m.messages;
        closeEvents = m.closeEvents;
    });
    (0, vitest_1.it)('launch() connects bridge and sets connected state', async () => {
        send(channel, 'initialize');
        await flush();
        send(channel, 'launch');
        await flush();
        const launchResp = findResponse(messages, 'launch');
        (0, vitest_1.expect)(launchResp).toBeDefined();
        (0, vitest_1.expect)(launchResp.success).toBe(true);
        (0, vitest_1.expect)(bridge.calls.some((c) => c.method === 'connect')).toBe(true);
        (0, vitest_1.expect)(bridge.calls.some((c) => c.method === 'pause')).toBe(true);
        const stoppedEvent = messages
            .map((m) => JSON.parse(m))
            .find((m) => m.type === 'event' && m.event === 'stopped');
        (0, vitest_1.expect)(stoppedEvent).toBeDefined();
        (0, vitest_1.expect)(stoppedEvent.body.reason).toBe('entry');
    });
    (0, vitest_1.it)('setBreakpoints with IP creates breakpoint via bridge', async () => {
        send(channel, 'initialize');
        await flush();
        send(channel, 'launch');
        await flush();
        send(channel, 'setBreakpoints', {
            source: { name: 'main.st' },
            breakpoints: [{ line: 42 }],
        });
        await flush();
        const addBpCall = bridge.calls.find((c) => c.method === 'addBreakpoint');
        (0, vitest_1.expect)(addBpCall).toBeDefined();
        (0, vitest_1.expect)(addBpCall.args[0]).toBe(42);
        const bpResp = findResponse(messages, 'setBreakpoints');
        (0, vitest_1.expect)(bpResp).toBeDefined();
        (0, vitest_1.expect)(bpResp.body.breakpoints).toHaveLength(1);
        (0, vitest_1.expect)(bpResp.body.breakpoints[0].verified).toBe(true);
        (0, vitest_1.expect)(bpResp.body.breakpoints[0].line).toBe(42);
    });
    (0, vitest_1.it)('threads returns main thread', async () => {
        send(channel, 'initialize');
        await flush();
        send(channel, 'launch');
        await flush();
        send(channel, 'threads');
        await flush();
        const threadsResp = findResponse(messages, 'threads');
        (0, vitest_1.expect)(threadsResp).toBeDefined();
        (0, vitest_1.expect)(threadsResp.success).toBe(true);
        (0, vitest_1.expect)(threadsResp.body.threads).toEqual([{ id: 1, name: 'main' }]);
    });
    (0, vitest_1.it)('stackTrace returns frame for current IP', async () => {
        bridge.setIp(16);
        send(channel, 'initialize');
        await flush();
        send(channel, 'launch');
        await flush();
        send(channel, 'stackTrace', { threadId: 1 });
        await flush();
        const stResp = findResponse(messages, 'stackTrace');
        (0, vitest_1.expect)(stResp).toBeDefined();
        (0, vitest_1.expect)(stResp.success).toBe(true);
        (0, vitest_1.expect)(stResp.body.totalFrames).toBe(1);
        const frame = stResp.body.stackFrames[0];
        (0, vitest_1.expect)(frame.name).toBe('ST Program');
        (0, vitest_1.expect)(frame.line).toBe(16);
        (0, vitest_1.expect)(frame.source).toEqual({ name: 'main.st' });
        (0, vitest_1.expect)(frame.instructionPointerReference).toBe('0x10');
    });
    // DAP disconnect command calls bridge.disconnect and responds success.
    // Note: close() is what fires onClose; DAP disconnect does not.
    (0, vitest_1.it)('disconnect DAP command calls bridge.disconnect and responds success', async () => {
        send(channel, 'initialize');
        await flush();
        send(channel, 'launch');
        await flush();
        send(channel, 'disconnect');
        await flush();
        const discCall = bridge.calls.find((c) => c.method === 'disconnect');
        (0, vitest_1.expect)(discCall).toBeDefined();
        const discResp = findResponse(messages, 'disconnect');
        (0, vitest_1.expect)(discResp).toBeDefined();
        (0, vitest_1.expect)(discResp.success).toBe(true);
    });
    // close() method fires onClose callback
    (0, vitest_1.it)('close() fires onClose callback when connected', async () => {
        send(channel, 'initialize');
        await flush();
        send(channel, 'launch');
        await flush();
        channel.close();
        (0, vitest_1.expect)(closeEvents).toHaveLength(1);
        (0, vitest_1.expect)(closeEvents[0].code).toBe(0);
        (0, vitest_1.expect)(closeEvents[0].reason).toBe('user');
    });
    (0, vitest_1.it)('pause command calls bridge.pause and emits stopped event', async () => {
        send(channel, 'initialize');
        await flush();
        send(channel, 'launch');
        await flush();
        send(channel, 'continue');
        await flush();
        send(channel, 'pause');
        await flush();
        (0, vitest_1.expect)(bridge.calls.some((c) => c.method === 'pause')).toBe(true);
        const pauseStopEvent = messages
            .map((m) => JSON.parse(m))
            .find((m) => m.type === 'event' && m.event === 'stopped' && m.body.reason === 'pause');
        (0, vitest_1.expect)(pauseStopEvent).toBeDefined();
    });
});
//# sourceMappingURL=debug.test.js.map