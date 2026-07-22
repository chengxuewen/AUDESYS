import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridge = require('../index.js');

describe('compileLd', () => {
  it('compiles a simple LD network through IL pipeline', () => {
    // compileLd delegates through ld_compile → il_compile → HalProgram.
    // A minimal LD network: a contact driving a coil.
    const ldSource = [
      'NETWORK',
      'TITLE = Simple',
      'LD %IX0.0',
      'ST %QX0.0',
    ].join('\n');

    const result = bridge.compileLd(ldSource);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(10);
  });

  it('throws on empty source', () => {
    expect(() => bridge.compileLd('')).toThrow();
  });
});
