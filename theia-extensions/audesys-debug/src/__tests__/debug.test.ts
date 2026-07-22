import { describe, it, expect, beforeEach } from 'vitest';
import { AudesysDebugChannel, IDebugBridge } from '../browser/debug-channel';

class MockBridge implements IDebugBridge {
  calls: { method: string; args: unknown[] }[] = [];
  private currentIp = 0;
  private breakpoints: number[] = [];

  async connect(_socketPath: string, _secret: string): Promise<string> {
    this.calls.push({ method: 'connect', args: [_socketPath, _secret] });
    return 'ok';
  }
  async disconnect(): Promise<string> {
    this.calls.push({ method: 'disconnect', args: [] });
    return 'ok';
  }
  async pause(): Promise<string> {
    this.calls.push({ method: 'pause', args: [] });
    return 'ok';
  }
  async resume(): Promise<string> {
    this.calls.push({ method: 'resume', args: [] });
    return 'ok';
  }
  async step(): Promise<string> {
    this.calls.push({ method: 'step', args: [] });
    return 'ok';
  }
  async getRegisters(): Promise<string> {
    this.calls.push({ method: 'getRegisters', args: [] });
    return JSON.stringify([['r0', '0x00000001'], ['r1', '0x00000002']]);
  }
  async getBreakpoints(): Promise<string> {
    this.calls.push({ method: 'getBreakpoints', args: [] });
    return JSON.stringify(this.breakpoints);
  }
  async addBreakpoint(ip: number): Promise<string> {
    this.calls.push({ method: 'addBreakpoint', args: [ip] });
    this.breakpoints.push(ip);
    return 'ok';
  }
  async removeBreakpoint(ip: number): Promise<string> {
    this.calls.push({ method: 'removeBreakpoint', args: [ip] });
    this.breakpoints = this.breakpoints.filter((b) => b !== ip);
    return 'ok';
  }
  async getState(): Promise<string> {
    this.calls.push({ method: 'getState', args: [] });
    return JSON.stringify({ current_ip: this.currentIp, breakpoints: this.breakpoints });
  }

  setIp(ip: number): void {
    this.currentIp = ip;
  }
}

function makeChannel(bridge?: MockBridge) {
  const b = bridge ?? new MockBridge();
  const msgs: string[] = [];
  const errs: unknown[] = [];
  const closes: { code: number; reason: string }[] = [];
  const ch = new AudesysDebugChannel({ socketPath: '/tmp/test.sock', secret: 'test-secret' }, b);
  ch.onMessage((m) => msgs.push(m));
  ch.onError((e) => errs.push(e));
  ch.onClose((code, reason) => closes.push({ code, reason }));
  return { channel: ch, bridge: b, messages: msgs, errors: errs, closeEvents: closes };
}

function send(channel: AudesysDebugChannel, command: string, args?: unknown, seq?: number): void {
  channel.send(JSON.stringify({ seq: seq ?? 1, command, arguments: args }));
}

// send() fires async dispatch() without await; flush lets microtasks settle
const flush = () => new Promise<void>((r) => setTimeout(r, 50));

function findResponse(msgs: string[], command: string) {
  for (const m of msgs) {
    const parsed = JSON.parse(m);
    if (parsed.type === 'response' && parsed.command === command) {
      return parsed as { success: boolean; body: Record<string, unknown> };
    }
  }
  return undefined;
}

describe('AudesysDebugChannel', () => {
  let channel: AudesysDebugChannel;
  let bridge: MockBridge;
  let messages: string[];
  let closeEvents: { code: number; reason: string }[];

  beforeEach(() => {
    const m = makeChannel();
    channel = m.channel;
    bridge = m.bridge;
    messages = m.messages;
    closeEvents = m.closeEvents;
  });

  it('launch() connects bridge and sets connected state', async () => {
    send(channel, 'initialize');
    await flush();

    send(channel, 'launch');
    await flush();

    const launchResp = findResponse(messages, 'launch');
    expect(launchResp).toBeDefined();
    expect(launchResp!.success).toBe(true);

    expect(bridge.calls.some((c) => c.method === 'connect')).toBe(true);
    expect(bridge.calls.some((c) => c.method === 'pause')).toBe(true);

    const stoppedEvent = messages
      .map((m) => JSON.parse(m))
      .find((m) => m.type === 'event' && m.event === 'stopped');
    expect(stoppedEvent).toBeDefined();
    expect(stoppedEvent!.body.reason).toBe('entry');
  });

  it('setBreakpoints with IP creates breakpoint via bridge', async () => {
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
    expect(addBpCall).toBeDefined();
    expect(addBpCall!.args[0]).toBe(42);

    const bpResp = findResponse(messages, 'setBreakpoints');
    expect(bpResp).toBeDefined();
    expect(bpResp!.body.breakpoints).toHaveLength(1);
    expect((bpResp!.body.breakpoints as Array<Record<string, unknown>>)[0].verified).toBe(true);
    expect((bpResp!.body.breakpoints as Array<Record<string, unknown>>)[0].line).toBe(42);
  });

  it('threads returns main thread', async () => {
    send(channel, 'initialize');
    await flush();
    send(channel, 'launch');
    await flush();

    send(channel, 'threads');
    await flush();

    const threadsResp = findResponse(messages, 'threads');
    expect(threadsResp).toBeDefined();
    expect(threadsResp!.success).toBe(true);
    expect(threadsResp!.body.threads).toEqual([{ id: 1, name: 'main' }]);
  });

  it('stackTrace returns frame for current IP', async () => {
    bridge.setIp(16);

    send(channel, 'initialize');
    await flush();
    send(channel, 'launch');
    await flush();

    send(channel, 'stackTrace', { threadId: 1 });
    await flush();

    const stResp = findResponse(messages, 'stackTrace');
    expect(stResp).toBeDefined();
    expect(stResp!.success).toBe(true);
    expect(stResp!.body.totalFrames).toBe(1);
    const frame = (stResp!.body.stackFrames as Array<Record<string, unknown>>)[0];
    expect(frame.name).toBe('ST Program');
    expect(frame.line).toBe(16);
    expect(frame.source).toEqual({ name: 'main.st' });
    expect(frame.instructionPointerReference).toBe('0x10');
  });

  // DAP disconnect command calls bridge.disconnect and responds success.
  // Note: close() is what fires onClose; DAP disconnect does not.
  it('disconnect DAP command calls bridge.disconnect and responds success', async () => {
    send(channel, 'initialize');
    await flush();
    send(channel, 'launch');
    await flush();

    send(channel, 'disconnect');
    await flush();

    const discCall = bridge.calls.find((c) => c.method === 'disconnect');
    expect(discCall).toBeDefined();

    const discResp = findResponse(messages, 'disconnect');
    expect(discResp).toBeDefined();
    expect(discResp!.success).toBe(true);
  });

  // close() method fires onClose callback
  it('close() fires onClose callback when connected', async () => {
    send(channel, 'initialize');
    await flush();
    send(channel, 'launch');
    await flush();

    channel.close();

    expect(closeEvents).toHaveLength(1);
    expect(closeEvents[0].code).toBe(0);
    expect(closeEvents[0].reason).toBe('user');
  });

  it('pause command calls bridge.pause and emits stopped event', async () => {
    send(channel, 'initialize');
    await flush();
    send(channel, 'launch');
    await flush();

    send(channel, 'continue');
    await flush();

    send(channel, 'pause');
    await flush();

    expect(bridge.calls.some((c) => c.method === 'pause')).toBe(true);

    const pauseStopEvent = messages
      .map((m) => JSON.parse(m))
      .find((m) => m.type === 'event' && m.event === 'stopped' && m.body.reason === 'pause');
    expect(pauseStopEvent).toBeDefined();
  });
});
