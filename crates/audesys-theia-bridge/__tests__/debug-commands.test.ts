import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridge = require('../index.js');

const SOCKET = '/tmp/audesys-test-nonexistent.sock';
const SECRET = 'test-secret';

describe('debug commands', () => {
  // ── debugPause ─────────────────────────────────────────────────
  describe('debugPause', () => {
    it('throws when no Controller is connected', () => {
      expect(() => bridge.debugPause(SOCKET, SECRET)).toThrow();
    });

    it('throws with empty socket path', () => {
      expect(() => bridge.debugPause('', SECRET)).toThrow();
    });
  });

  // ── debugResume ────────────────────────────────────────────────
  describe('debugResume', () => {
    it('throws when no Controller is connected', () => {
      expect(() => bridge.debugResume(SOCKET, SECRET)).toThrow();
    });

    it('throws with empty socket path', () => {
      expect(() => bridge.debugResume('', SECRET)).toThrow();
    });
  });

  // ── debugStep ──────────────────────────────────────────────────
  describe('debugStep', () => {
    it('throws when no Controller is connected', () => {
      expect(() => bridge.debugStep(SOCKET, SECRET)).toThrow();
    });

    it('throws with empty socket path', () => {
      expect(() => bridge.debugStep('', SECRET)).toThrow();
    });
  });

  // ── debugGetRegisters ──────────────────────────────────────────
  describe('debugGetRegisters', () => {
    it('throws when no Controller is connected', () => {
      expect(() => bridge.debugGetRegisters(SOCKET, SECRET)).toThrow();
    });
  });

  // ── debugAddBreakpoint ─────────────────────────────────────────
  describe('debugAddBreakpoint', () => {
    it('throws when no Controller is connected', () => {
      expect(() => bridge.debugAddBreakpoint(SOCKET, SECRET, 42)).toThrow();
    });

    it('throws with ip=0 when no Controller', () => {
      expect(() => bridge.debugAddBreakpoint(SOCKET, SECRET, 0)).toThrow();
    });

    it('throws with high ip value when no Controller', () => {
      expect(() => bridge.debugAddBreakpoint(SOCKET, SECRET, 65535)).toThrow();
    });
  });

  // ── debugRemoveBreakpoint ──────────────────────────────────────
  describe('debugRemoveBreakpoint', () => {
    it('throws when no Controller is connected', () => {
      expect(() => bridge.debugRemoveBreakpoint(SOCKET, SECRET, 42)).toThrow();
    });

    it('throws for non-existent breakpoint (ip=9999)', () => {
      expect(() => bridge.debugRemoveBreakpoint(SOCKET, SECRET, 9999)).toThrow();
    });
  });

  // ── debugGetBreakpoints ────────────────────────────────────────
  describe('debugGetBreakpoints', () => {
    it('throws when no Controller is connected', () => {
      expect(() => bridge.debugGetBreakpoints(SOCKET, SECRET)).toThrow();
    });

    it('throws with empty credentials', () => {
      expect(() => bridge.debugGetBreakpoints('', '')).toThrow();
    });
  });

  // ── debugConnect ───────────────────────────────────────────────
  describe('debugConnect', () => {
    it('throws when no Controller is running', () => {
      expect(() => bridge.debugConnect(SOCKET, SECRET)).toThrow();
    });

    it('throws with empty socket path', () => {
      expect(() => bridge.debugConnect('', SECRET)).toThrow();
    });
  });
});
