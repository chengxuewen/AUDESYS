import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridge = require('../index.js');

describe('deployProgram', () => {
  it('throws when no Controller is running', () => {
    expect(() => bridge.deployProgram('/tmp/test.sock', 'secret', '{"program":{}}')).toThrow();
  });
});

  it('throws with empty socket path', () => {
    expect(() => bridge.deployProgram('', 'secret', '{"program":{}}')).toThrow();
  });

  it('throws with invalid program JSON', () => {
    expect(() => bridge.deployProgram('/tmp/test.sock', 'secret', 'not json')).toThrow();
  });
