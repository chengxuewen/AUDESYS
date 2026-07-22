import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridge = require('../index.js');

describe('healthQuery', () => {
  it('throws when no Controller is running', () => {
    expect(() => bridge.healthQuery('/tmp/test.sock', 'secret')).toThrow();
  });

  it('throws with descriptive error on empty parameters', () => {
    expect(() => bridge.healthQuery('', '')).toThrow();
  });
});

  it('throws with an invalid (non-existent) socket path', () => {
    expect(() => bridge.healthQuery('/tmp/does-not-exist.sock', 'secret')).toThrow();
  });
