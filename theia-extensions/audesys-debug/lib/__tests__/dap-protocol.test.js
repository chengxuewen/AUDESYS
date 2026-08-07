"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const dap_protocol_1 = require("../browser/dap-protocol");
(0, vitest_1.describe)('encodeRequest', () => {
    (0, vitest_1.it)('produces a Content-Length frame with matching byte length', () => {
        const frame = (0, dap_protocol_1.encodeRequest)(1, 'initialize');
        const headerEnd = frame.indexOf('\r\n\r\n');
        const declared = Number(/Content-Length:\s*(\d+)/i.exec(frame.slice(0, headerEnd))[1]);
        const body = frame.slice(headerEnd + 4);
        // JSON body byte length must equal the declared Content-Length
        (0, vitest_1.expect)(Buffer.byteLength(body, 'utf8')).toBe(declared);
    });
    (0, vitest_1.it)('omits arguments when absent', () => {
        const frame = (0, dap_protocol_1.encodeRequest)(2, 'pause');
        (0, vitest_1.expect)(frame).toContain('"command":"pause"');
        (0, vitest_1.expect)(frame).not.toContain('"arguments"');
    });
    (0, vitest_1.it)('includes arguments as the arguments field when provided', () => {
        const frame = (0, dap_protocol_1.encodeRequest)(3, 'attach', { socketPath: '/tmp/s.sock', secret: 'x' });
        (0, vitest_1.expect)(frame).toContain('"arguments":');
        (0, vitest_1.expect)(frame).toContain('"socketPath":"/tmp/s.sock"');
    });
});
(0, vitest_1.describe)('decodeFrames', () => {
    (0, vitest_1.it)('parses a single complete frame', () => {
        const body = JSON.stringify({ type: 'response', request_seq: 1, success: true, command: 'initialize' });
        const frame = `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
        const { frames, rest } = (0, dap_protocol_1.decodeFrames)(frame);
        (0, vitest_1.expect)(frames).toHaveLength(1);
        (0, vitest_1.expect)(frames[0].command).toBe('initialize');
        (0, vitest_1.expect)(rest).toBe('');
    });
    (0, vitest_1.it)('parses multiple back-to-back frames', () => {
        const mk = (seq) => {
            const body = JSON.stringify({ type: 'event', event: 'stopped', seq });
            return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
        };
        const { frames, rest } = (0, dap_protocol_1.decodeFrames)(mk(1) + mk(2));
        const events = frames;
        (0, vitest_1.expect)(events).toHaveLength(2);
        (0, vitest_1.expect)(events[0].seq).toBe(1);
        (0, vitest_1.expect)(events[1].seq).toBe(2);
        (0, vitest_1.expect)(rest).toBe('');
    });
    (0, vitest_1.it)('leaves a partial frame in rest for the next chunk', () => {
        const body = JSON.stringify({ type: 'response', request_seq: 1, success: true, command: 'continue' });
        const full = `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
        const splitAt = full.length - 3; // cut mid-body
        const { frames, rest } = (0, dap_protocol_1.decodeFrames)(full.slice(0, splitAt));
        (0, vitest_1.expect)(frames).toHaveLength(0);
        (0, vitest_1.expect)(rest).toBe(full.slice(0, splitAt));
    });
    (0, vitest_1.it)('recovers a complete frame split across two chunks', () => {
        const body = JSON.stringify({ type: 'response', request_seq: 7, success: true, command: 'variables' });
        const full = `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
        const splitAt = 12; // cut inside the header
        const first = (0, dap_protocol_1.decodeFrames)(full.slice(0, splitAt));
        (0, vitest_1.expect)(first.frames).toHaveLength(0);
        const second = (0, dap_protocol_1.decodeFrames)(first.rest + full.slice(splitAt));
        const frames = second.frames;
        (0, vitest_1.expect)(frames).toHaveLength(1);
        (0, vitest_1.expect)(frames[0].command).toBe('variables');
        (0, vitest_1.expect)(second.rest).toBe('');
    });
    (0, vitest_1.it)('skips malformed frames and continues scanning', () => {
        const body = JSON.stringify({ type: 'response', request_seq: 3, success: true, command: 'pause' });
        const good = `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
        const garbled = 'garbage-not-a-frame';
        const { frames, rest } = (0, dap_protocol_1.decodeFrames)(garbled + good);
        (0, vitest_1.expect)(frames).toHaveLength(1);
        (0, vitest_1.expect)(frames[0].command).toBe('pause');
        (0, vitest_1.expect)(rest).toBe('');
    });
});
(0, vitest_1.describe)('end-to-end round trip', () => {
    (0, vitest_1.it)('encode then decode yields the original request', () => {
        const frame = (0, dap_protocol_1.encodeRequest)(10, 'setBreakpoints', { source: { name: 'main.st' }, breakpoints: [{ line: 42 }] });
        const { frames, rest } = (0, dap_protocol_1.decodeFrames)(frame);
        (0, vitest_1.expect)(frames).toHaveLength(1);
        const f = frames[0];
        (0, vitest_1.expect)(f.command).toBe('setBreakpoints');
        (0, vitest_1.expect)(rest).toBe('');
    });
});
//# sourceMappingURL=dap-protocol.test.js.map