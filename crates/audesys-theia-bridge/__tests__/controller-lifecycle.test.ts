import { describe, it, expect, afterAll } from 'vitest';
import { existsSync, unlinkSync } from 'fs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridge = require('../index.js');

const SOCKET = '/tmp/audesys-controller.sock';
const BINARY = `${__dirname}/../../../target/debug/audesys-controller`;
const BINARY_RELEASE = `${__dirname}/../../../target/release/audesys-controller`;
const CONTROLLER_BIN = existsSync(BINARY) ? BINARY :
  (existsSync(BINARY_RELEASE) ? BINARY_RELEASE : null);

afterAll(() => {
  try { unlinkSync(SOCKET); } catch (_) { /* ok */ }
  try { bridge.controllerStop(); } catch (_) { /* ok */ }
});

describe('controller lifecycle', () => {

  describe('controllerStart', () => {
    it('rejects when binary does not exist', () => {
      expect(() => bridge.controllerStart('/tmp/no.sock', '/no/such/binary'))
        .toThrow('binary not found');
    });

    it('rejects on empty socket path', () => {
      if (!CONTROLLER_BIN) return;
      expect(() => bridge.controllerStart('', CONTROLLER_BIN)).toThrow();
    });
  });

  describe('controllerHealth', () => {
    it('returns alive=false when no controller is running', () => {
      try { bridge.controllerStop(); } catch (_) { /* ok */ }
      const result = bridge.controllerHealth();
      const parsed = JSON.parse(result);
      expect(parsed.alive).toBe(false);
      expect(parsed.pid).toBeNull();
      expect(parsed.uptime_sec).toBe(0);
    });
  });

  describe('controllerStop', () => {
    it('rejects when no controller is running', () => {
      try { bridge.controllerStop(); } catch (_) { /* ok */ }
      expect(() => bridge.controllerStop()).toThrow('no controller running');
    });
  });
});
