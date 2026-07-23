import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridge = require('../index.js');

const SOCKET = '/tmp/audesys-test-nonexistent.sock';
const SECRET = 'test-secret';

describe('loadHalConfig', () => {
  it('throws when no Controller is connected', () => {
    expect(() => bridge.loadHalConfig(SOCKET, SECRET, 'signals: []')).toThrow();
  });

  it('throws with empty socket path', () => {
    expect(() => bridge.loadHalConfig('', SECRET, 'signals: []')).toThrow();
  });

  it('throws with empty secret', () => {
    expect(() => bridge.loadHalConfig(SOCKET, '', 'signals: []')).toThrow();
  });

  it('throws with empty YAML config', () => {
    expect(() => bridge.loadHalConfig(SOCKET, SECRET, '')).toThrow();
  });

  it('throws with invalid YAML', () => {
    expect(() => bridge.loadHalConfig(SOCKET, SECRET, '}}}invalid yaml')).toThrow();
  });
});
