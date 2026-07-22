import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridge = require('../index.js');

describe('signalSnapshot', () => {
  it('throws when no Controller is running', () => {
    expect(() => bridge.signalSnapshot('/tmp/test.sock', 'secret', '*')).toThrow();
  });
});
