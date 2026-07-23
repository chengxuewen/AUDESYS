import { describe, it, expect } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridge = require('../index.js');

describe('compiler — fbd', () => {
  it('compiles TON block', () => {
    const result = bridge.compileFbd('BLOCK ton1 TON');
    const parsed = JSON.parse(result);
    expect(parsed.instructions).toBeDefined();
  });

  it('throws on empty source', () => {
    expect(() => bridge.compileFbd('')).toThrow();
  });

  it('throws on invalid syntax', () => {
    expect(() => bridge.compileFbd('not a block')).toThrow();
  });
});

describe('compiler — sfc', () => {
  it('compiles single step with action', () => {
    const sfc = 'STEP S1\n  ACTION N: x := 1;\nEND_STEP\n';
    const result = bridge.compileSfc(sfc);
    const parsed = JSON.parse(result);
    expect(parsed.instructions).toBeDefined();
  });

  it('throws on empty source', () => {
    expect(() => bridge.compileSfc('')).toThrow();
  });
});

describe('compiler — gcode', () => {
  it('compiles G0 rapid move', () => {
    const result = bridge.compileGcode('G0 X10 Y20 Z30\n');
    const parsed = JSON.parse(result);
    expect(parsed.instructions).toBeDefined();
  });

  it('compiles empty program marker', () => {
    const result = bridge.compileGcode('%\n');
    const parsed = JSON.parse(result);
    expect(parsed.instructions).toBeDefined();
  });
});

describe('simulation — real implementations', () => {
  it('simCreate succeeds with valid cycle', () => {
    const result = bridge.simCreate(100);
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe('created');
    bridge.simDestroy();
  });

  it('simCreate rejects invalid args', () => {
    expect(() => bridge.simCreate('bad')).toThrow();
  });

  it('simStep returns snapshot', () => {
    bridge.simCreate(100);
    const result = bridge.simStep();
    expect(result).toBeDefined();
    bridge.simDestroy();
  });
});

describe('project — real implementations', () => {
  it('openProject throws on nonexistent path', () => {
    expect(() => bridge.openProject('/nonexistent/path')).toThrow();
  });

  it('readProjectFile throws on nonexistent file', () => {
    expect(() => bridge.readProjectFile('/nonexistent/file.st')).toThrow();
  });
});

describe('hmi layout — real implementations', () => {
  it('saveHmiLayout writes to file', () => {
    const result = bridge.saveHmiLayout('/tmp/test-hmi.yaml', 'layout: {}');
    expect(result).toBeDefined();
  });

  it('loadHmiLayout reads file', () => {
    bridge.saveHmiLayout('/tmp/test-hmi-read.yaml', 'layout: {}');
    const result = bridge.loadHmiLayout('/tmp/test-hmi-read.yaml');
    expect(result).toContain('layout');
  });

  it('loadHmiLayout throws on nonexistent', () => {
    expect(() => bridge.loadHmiLayout('/nonexistent.yaml')).toThrow();
  });
});
