import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridge = require('../index.js');

describe('compileIl', () => {
  it('compiles a simple IL listing', () => {
    const result = bridge.compileIl('LD 1\nST x');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(10);
  });

  it('returns valid JSON even on unusual input', () => {
    const result = bridge.compileIl('');
    expect(() => JSON.parse(result)).not.toThrow();
    expect(result).toBeTruthy();
  });
});
