import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridge = require('../index.js');

describe('compileFbd', () => {
  it('compiles a single TON block', () => {
    const fbdSource = 'BLOCK ton1 TON\n\nton1.IN := x\nton1.PT := 500\n\nresult := ton1.Q';
    const result = bridge.compileFbd(fbdSource);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(10);
  });

  it('compiles two blocks (TON + CTU)', () => {
    const fbdSource = [
      'BLOCK ton1 TON',
      '',
      'ton1.IN := x',
      'ton1.PT := 500',
      '',
      'BLOCK cnt1 CTU',
      '',
      'cnt1.CU := ton1.Q',
      'cnt1.PV := 10',
      '',
      'result := cnt1.Q',
    ].join('\n');
    const result = bridge.compileFbd(fbdSource);
    expect(result).toBeTruthy();
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('throws on empty source', () => {
    expect(() => bridge.compileFbd('')).toThrow();
  });

  it('throws on invalid syntax', () => {
    expect(() => bridge.compileFbd('invalid syntax !!!')).toThrow();
  });

  it('throws on unknown block kind', () => {
    expect(() => bridge.compileFbd('BLOCK bad XYZ')).toThrow();
  });
});
