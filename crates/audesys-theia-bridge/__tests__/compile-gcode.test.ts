import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridge = require('../index.js');

describe('compileGcode', () => {
  it('compiles a simple rapid move (G0)', () => {
    const result = bridge.compileGcode('G0 X10 Y20 Z30');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(10);
  });

  it('compiles a full pipeline (G90 G21 G0 G1 M3 M5 M30)', () => {
    const gcode = [
      'G90 G21 G17',
      'G0 X0 Y0 Z5',
      'M3 S1000',
      'G1 X100 Y50 F200',
      'M5',
      'M30',
    ].join('\n');
    const result = bridge.compileGcode(gcode);
    expect(result).toBeTruthy();
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('compiles empty program marker (%)', () => {
    const result = bridge.compileGcode('%');
    expect(result).toBeTruthy();
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('throws on unsupported G-code (G99)', () => {
    expect(() => bridge.compileGcode('G99 X10')).toThrow();
  });

  it('throws on completely unsupported command', () => {
    expect(() => bridge.compileGcode('G999 X0')).toThrow();
  });
});
