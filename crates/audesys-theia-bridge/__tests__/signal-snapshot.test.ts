import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridge = require('../index.js');

describe('signalSnapshot', () => {
  it('throws when no Controller is running', () => {
    expect(() => bridge.signalSnapshot('/tmp/test.sock', 'secret', '*')).toThrow();
  });
});

  it('throws with empty socket path', () => {
    expect(() => bridge.signalSnapshot('', 'secret', '*')).toThrow();
  });

  it('throws with empty secret', () => {
    expect(() => bridge.signalSnapshot('/tmp/test.sock', '', '*')).toThrow();
  });
