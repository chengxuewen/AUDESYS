import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridge = require('../index.js');

describe('deployProgram', () => {
  it('throws when no Controller is running', () => {
    expect(() => bridge.deployProgram('/tmp/test.sock', 'secret', '{"program":{}}')).toThrow();
  });
});
