import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridge = require('../index.js');

describe('simulation and debug stubs', () => {
  // ── Simulation stubs ──────────────────────────────────────────────

  describe('simCreate', () => {
    it('throws not-implemented', () => {
      expect(() => bridge.simCreate(100)).toThrow('not implemented');
    });
    it('throws not-implemented with zero cycle time', () => {
      expect(() => bridge.simCreate(0)).toThrow('not implemented');
    });
  });

  describe('simDestroy', () => {
    it('throws not-implemented', () => {
      expect(() => bridge.simDestroy()).toThrow('not implemented');
    });
    it('throws not-implemented when called twice', () => {
      expect(() => bridge.simDestroy()).toThrow('not implemented');
      expect(() => bridge.simDestroy()).toThrow('not implemented');
    });
  });

  describe('simStep', () => {
    it('throws not-implemented', () => {
      expect(() => bridge.simStep()).toThrow('not implemented');
    });
    it('throws not-implemented with no prior simCreate', () => {
      expect(() => bridge.simStep()).toThrow('not implemented');
    });
  });

  // ── Debug stubs ───────────────────────────────────────────────────

  describe('debugConnect', () => {
    it('throws with socket and secret', () => {
      expect(() => bridge.debugConnect('/tmp/sock', 'secret')).toThrow('not implemented');
    });
    it('throws with empty args', () => {
      expect(() => bridge.debugConnect('', '')).toThrow('not implemented');
    });
  });

  describe('debugDisconnect', () => {
    it('throws when called', () => {
      expect(() => bridge.debugDisconnect()).toThrow('not implemented');
    });
    it('throws when called twice', () => {
      expect(() => bridge.debugDisconnect()).toThrow('not implemented');
      expect(() => bridge.debugDisconnect()).toThrow('not implemented');
    });
  });

  describe('debugPause', () => {
    it('throws when called', () => {
      expect(() => bridge.debugPause()).toThrow('not implemented');
    });
    it('throws when called twice', () => {
      expect(() => bridge.debugPause()).toThrow('not implemented');
      expect(() => bridge.debugPause()).toThrow('not implemented');
    });
  });

  describe('debugResume', () => {
    it('throws when called', () => {
      expect(() => bridge.debugResume()).toThrow('not implemented');
    });
    it('throws when called twice', () => {
      expect(() => bridge.debugResume()).toThrow('not implemented');
      expect(() => bridge.debugResume()).toThrow('not implemented');
    });
  });

  describe('debugStep', () => {
    it('throws when called', () => {
      expect(() => bridge.debugStep()).toThrow('not implemented');
    });
    it('throws when called twice', () => {
      expect(() => bridge.debugStep()).toThrow('not implemented');
      expect(() => bridge.debugStep()).toThrow('not implemented');
    });
  });

  describe('debugAddBreakpoint', () => {
    it('throws with ip=42', () => {
      expect(() => bridge.debugAddBreakpoint(42)).toThrow('not implemented');
    });
    it('throws with ip=0', () => {
      expect(() => bridge.debugAddBreakpoint(0)).toThrow('not implemented');
    });
  });

  describe('debugRemoveBreakpoint', () => {
    it('throws with ip=42', () => {
      expect(() => bridge.debugRemoveBreakpoint(42)).toThrow('not implemented');
    });
    it('throws with ip=0', () => {
      expect(() => bridge.debugRemoveBreakpoint(0)).toThrow('not implemented');
    });
  });

  describe('debugGetBreakpoints', () => {
    it('throws when called', () => {
      expect(() => bridge.debugGetBreakpoints()).toThrow('not implemented');
    });
    it('throws when called twice', () => {
      expect(() => bridge.debugGetBreakpoints()).toThrow('not implemented');
      expect(() => bridge.debugGetBreakpoints()).toThrow('not implemented');
    });
  });

  describe('debugGetRegisters', () => {
    it('throws when called', () => {
      expect(() => bridge.debugGetRegisters()).toThrow('not implemented');
    });
    it('throws when called twice', () => {
      expect(() => bridge.debugGetRegisters()).toThrow('not implemented');
      expect(() => bridge.debugGetRegisters()).toThrow('not implemented');
    });
  });

  describe('debugGetState', () => {
    it('throws when called', () => {
      expect(() => bridge.debugGetState()).toThrow('not implemented');
    });
    it('throws when called twice', () => {
      expect(() => bridge.debugGetState()).toThrow('not implemented');
      expect(() => bridge.debugGetState()).toThrow('not implemented');
    });
  });

  // ── Config/HMI stubs (additional, beyond existing stubs.test.ts) ───

  describe('deployHmiLayout (extra)', () => {
    it('throws with empty args', () => {
      expect(() => bridge.deployHmiLayout('', '', '')).toThrow('not implemented');
    });
  });

  describe('loadHalConfig (extra)', () => {
    it('throws with empty args', () => {
      expect(() => bridge.loadHalConfig('', '', '')).toThrow('not implemented');
    });
  });
});
