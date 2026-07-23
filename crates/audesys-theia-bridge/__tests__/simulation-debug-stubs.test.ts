import { describe, it, expect, afterEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridge = require('../index.js');

afterEach(() => {
  try { bridge.simDestroy(); } catch (_e) { /* ignore */ }
});

describe('simulation — lifecycle', () => {
  describe('simCreate', () => {
    it('creates simulation with valid cycle', () => {
      const result = bridge.simCreate(100);
      const parsed = JSON.parse(result);
      expect(parsed.status).toBe('created');
    });

    it('rejects negative cycle time', () => {
      expect(() => bridge.simCreate('bad')).toThrow();
    });
  });

  describe('simDestroy', () => {
    it('destroys simulation', () => {
      bridge.simCreate(100);
      const result = bridge.simDestroy();
      expect(result).toContain('destroyed');
    });

    it('succeeds idempotently', () => {
      const result = bridge.simDestroy();
      expect(result).toContain('destroyed');
    });
  });
  describe('simStep', () => {
    it('steps simulation and returns snapshot', () => {
      bridge.simCreate(100);
      const result = bridge.simStep();
      expect(result).toBeDefined();
      expect(result).not.toBe('');
    });

    it('throws when no simulation exists', () => {
      expect(() => bridge.simStep()).toThrow();
    });
  });
});

describe('debug — no controller', () => {
  describe('debugConnect', () => {
    it('throws on nonexistent socket', () => {
      expect(() => bridge.debugConnect('/tmp/nonexistent.sock', 'secret')).toThrow();
    });
  });

  describe('debugDisconnect', () => {
    it('succeeds when called (no-op)', () => {
      const result = bridge.debugDisconnect();
      expect(result).toBe('disconnected');
    });
  });

  describe('debugPause', () => {
    it('throws without socket_path param', () => {
      expect(() => bridge.debugPause()).toThrow();
    });
  });

  describe('debugResume', () => {
    it('throws without socket_path param', () => {
      expect(() => bridge.debugResume()).toThrow();
    });
  });

  describe('debugStep', () => {
    it('throws without socket_path param', () => {
      expect(() => bridge.debugStep()).toThrow();
    });
  });

  describe('debugAddBreakpoint', () => {
    it('throws without socket_path param', () => {
      expect(() => bridge.debugAddBreakpoint()).toThrow();
    });
  });

  describe('debugRemoveBreakpoint', () => {
    it('throws without socket_path param', () => {
      expect(() => bridge.debugRemoveBreakpoint()).toThrow();
    });
  });

  describe('debugGetBreakpoints', () => {
    it('throws without socket_path param', () => {
      expect(() => bridge.debugGetBreakpoints()).toThrow();
    });
  });

  describe('debugGetRegisters', () => {
    it('throws without socket_path param', () => {
      expect(() => bridge.debugGetRegisters()).toThrow();
    });
  });
});

describe('hmi layout — real implementations', () => {
  describe('deployHmiLayout', () => {
    it('throws on nonexistent socket', () => {
      expect(() => bridge.deployHmiLayout('/tmp/nonexistent.sock', 'secret', 'yaml: content')).toThrow();
    });
  });

  describe('loadHalConfig', () => {
    it('throws on nonexistent socket', () => {
      expect(() => bridge.loadHalConfig('/tmp/nonexistent.sock', 'secret', 'config: {}')).toThrow();
    });
  });
});
