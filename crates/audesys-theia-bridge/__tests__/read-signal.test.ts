import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridge = require('../index.js');

describe('readSignal', () => {
  it('throws when no Controller is running', () => {
    expect(() => bridge.readSignal('/tmp/test.sock', 'secret', 'axis.0.pos')).toThrow();
  });

  it('throws with descriptive error on empty parameters', () => {
    expect(() => bridge.readSignal('', '', '')).toThrow();
  });
});
