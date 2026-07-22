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

  it('compiles a multi-line IL with JMP/LBL', () => {
    const result = bridge.compileIl('LD %IX0.0\nJMPC label1\nLD 0\nST %QX0.0\nlabel1: LD 1\nST %QX0.1');
    expect(result).toBeTruthy();
    expect(() => JSON.parse(result)).not.toThrow();
  });
