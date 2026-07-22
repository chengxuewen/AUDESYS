import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridge = require('../index.js');

describe('compileSt', () => {
  it('compiles a minimal PROGRAM', () => {
    const result = bridge.compileSt('PROGRAM main END_PROGRAM');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(10);
  });

  it('compiles a PROGRAM with variable declaration and assignment', () => {
    const result = bridge.compileSt('PROGRAM test VAR x:INT; END_VAR x:=1; END_PROGRAM');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(10);
  });

  it('throws on empty source', () => {
    expect(() => bridge.compileSt('')).toThrow();
  });

  it('throws on invalid syntax', () => {
    expect(() => bridge.compileSt('invalid syntax !!!')).toThrow();
  });
});
