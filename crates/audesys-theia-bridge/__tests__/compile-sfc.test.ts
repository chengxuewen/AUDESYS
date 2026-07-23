import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridge = require('../index.js');

describe('compileSfc', () => {
  it('compiles a single step with action', () => {
    const sfcSource = 'STEP Init\n  ACTION N: x := 0;\nEND_STEP\n';
    const result = bridge.compileSfc(sfcSource);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(10);
  });

  it('compiles two steps with transition', () => {
    const sfcSource = [
      'STEP Init',
      '  ACTION N: x := 0;',
      'END_STEP',
      'TRANSITION FROM Init TO Run : start = TRUE',
      'END_TRANSITION',
      'STEP Run',
      '  ACTION P1: x := x + 1;',
      'END_STEP',
    ].join('\n');
    const result = bridge.compileSfc(sfcSource);
    expect(result).toBeTruthy();
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('throws on empty source', () => {
    expect(() => bridge.compileSfc('')).toThrow();
  });

  it('throws on invalid syntax (no steps)', () => {
    expect(() => bridge.compileSfc('not a valid sfc')).toThrow();
  });

  it('throws on missing FROM step in transition', () => {
    const sfcSource = [
      'STEP Init',
      '  ACTION N: x := 0;',
      'END_STEP',
      'TRANSITION FROM Missing TO Init : TRUE',
      'END_TRANSITION',
    ].join('\n');
    expect(() => bridge.compileSfc(sfcSource)).toThrow();
  });
});
