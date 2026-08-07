import { describe, it, expect } from 'vitest';
import { encodeRequest, decodeFrames, DapFrame } from '../browser/dap-protocol';

describe('encodeRequest', () => {
  it('produces a Content-Length frame with matching byte length', () => {
    const frame = encodeRequest(1, 'initialize');
    const headerEnd = frame.indexOf('\r\n\r\n');
    const declared = Number(/Content-Length:\s*(\d+)/i.exec(frame.slice(0, headerEnd))![1]);
    const body = frame.slice(headerEnd + 4);
    // JSON body byte length must equal the declared Content-Length
    expect(Buffer.byteLength(body, 'utf8')).toBe(declared);
  });

  it('omits arguments when absent', () => {
    const frame = encodeRequest(2, 'pause');
    expect(frame).toContain('"command":"pause"');
    expect(frame).not.toContain('"arguments"');
  });

  it('includes arguments as the arguments field when provided', () => {
    const frame = encodeRequest(3, 'attach', { socketPath: '/tmp/s.sock', secret: 'x' });
    expect(frame).toContain('"arguments":');
    expect(frame).toContain('"socketPath":"/tmp/s.sock"');
  });
});

describe('decodeFrames', () => {
  it('parses a single complete frame', () => {
    const body = JSON.stringify({ type: 'response', request_seq: 1, success: true, command: 'initialize' });
    const frame = `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
    const { frames, rest } = decodeFrames(frame);
    expect(frames).toHaveLength(1);
    expect((frames[0] as { command: string }).command).toBe('initialize');
    expect(rest).toBe('');
  });

  it('parses multiple back-to-back frames', () => {
    const mk = (seq: number) => {
      const body = JSON.stringify({ type: 'event', event: 'stopped', seq });
      return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
    };
    const { frames, rest } = decodeFrames(mk(1) + mk(2));
    const events = frames as Array<{ event: string; seq: number }>;
    expect(events).toHaveLength(2);
    expect(events[0].seq).toBe(1);
    expect(events[1].seq).toBe(2);
    expect(rest).toBe('');
  });

  it('leaves a partial frame in rest for the next chunk', () => {
    const body = JSON.stringify({ type: 'response', request_seq: 1, success: true, command: 'continue' });
    const full = `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
    const splitAt = full.length - 3; // cut mid-body
    const { frames, rest } = decodeFrames(full.slice(0, splitAt));
    expect(frames).toHaveLength(0);
    expect(rest).toBe(full.slice(0, splitAt));
  });

  it('recovers a complete frame split across two chunks', () => {
    const body = JSON.stringify({ type: 'response', request_seq: 7, success: true, command: 'variables' });
    const full = `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
    const splitAt = 12; // cut inside the header
    const first = decodeFrames(full.slice(0, splitAt));
    expect(first.frames).toHaveLength(0);
    const second = decodeFrames(first.rest + full.slice(splitAt));
    const frames = second.frames as Array<{ command: string }>;
    expect(frames).toHaveLength(1);
    expect(frames[0].command).toBe('variables');
    expect(second.rest).toBe('');
  });

  it('skips malformed frames and continues scanning', () => {
    const body = JSON.stringify({ type: 'response', request_seq: 3, success: true, command: 'pause' });
    const good = `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
    const garbled = 'garbage-not-a-frame';
    const { frames, rest } = decodeFrames(garbled + good);
    expect(frames).toHaveLength(1);
    expect((frames[0] as { command: string }).command).toBe('pause');
    expect(rest).toBe('');
  });
});

describe('end-to-end round trip', () => {
  it('encode then decode yields the original request', () => {
    const frame = encodeRequest(10, 'setBreakpoints', { source: { name: 'main.st' }, breakpoints: [{ line: 42 }] });
    const { frames, rest } = decodeFrames(frame);
    expect(frames).toHaveLength(1);
    const f = frames[0] as DapFrame;
    expect((f as { command: string }).command).toBe('setBreakpoints');
    expect(rest).toBe('');
  });
});