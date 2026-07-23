import { describe, it, expect, afterAll } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridge = require('../index.js');

// ── Simulation ──────────────────────────────────────────────────

describe('simCreate', () => {
  afterAll(() => {
    // Clean up any leftover simulation
    try { bridge.simDestroy(); } catch (_) { /* ok */ }
  });

  it('creates a simulation with valid cycle_ms', () => {
    // Ensure clean state
    try { bridge.simDestroy(); } catch (_) { /* ok */ }

    const result = bridge.simCreate(10);
    expect(result).toBeTruthy();
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe('created');
    expect(parsed.cycle_ms).toBe(10);
  });

  it('throws when simulation already active', () => {
    // Ensure one is active from prior test or create one
    try { bridge.simCreate(10); } catch (_) { /* already active */ }
    expect(() => bridge.simCreate(10)).toThrow('simulation already active');
  });

  it('creates simulation with zero cycle_ms', () => {
    try { bridge.simDestroy(); } catch (_) { /* ok */ }
    const result = bridge.simCreate(0);
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe('created');
    expect(parsed.cycle_ms).toBe(0);
  });
});

describe('simStep', () => {
  afterAll(() => {
    try { bridge.simDestroy(); } catch (_) { /* ok */ }
  });

  it('throws when no simulation is active', () => {
    try { bridge.simDestroy(); } catch (_) { /* ok */ }
    expect(() => bridge.simStep()).toThrow('no simulation active');
  });

  it('returns signal states after stepping', () => {
    try { bridge.simDestroy(); } catch (_) { /* ok */ }
    bridge.simCreate(10);
    const result = bridge.simStep();
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    // Should be a JSON array
    const parsed = JSON.parse(result);
    expect(Array.isArray(parsed)).toBe(true);
  });
});

describe('simDestroy', () => {
  it('returns destroyed status', () => {
    // Ensure one exists
    try { bridge.simCreate(10); } catch (_) { /* ok */ }
    const result = bridge.simDestroy();
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe('destroyed');
  });

  it('does not throw when no simulation is active', () => {
    // simDestroy takes Option::take(), so calling on None is fine
    const result = bridge.simDestroy();
    const parsed = JSON.parse(result);
    expect(parsed.status).toBe('destroyed');
  });
});

// ── Project management ──────────────────────────────────────────

describe('openProject', () => {
  it('throws when project path does not exist', () => {
    expect(() => bridge.openProject('/tmp/nonexistent-project-dir')).toThrow();
  });

  it('throws when path has no .audesys-project.yaml', () => {
    // /tmp exists but has no .audesys-project.yaml
    expect(() => bridge.openProject('/tmp')).toThrow();
  });

  it('throws with empty path', () => {
    expect(() => bridge.openProject('')).toThrow();
  });
});

describe('readProjectFile', () => {
  it('throws when file does not exist', () => {
    expect(() => bridge.readProjectFile('/tmp/nonexistent-file-xyz.st')).toThrow();
  });

  it('throws with empty path', () => {
    expect(() => bridge.readProjectFile('')).toThrow();
  });

  it('throws with directory path', () => {
    expect(() => bridge.readProjectFile('/tmp')).toThrow();
  });
});
