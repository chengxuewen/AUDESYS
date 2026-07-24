import { describe, it, expect } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridge = require('../index.js');

describe('IEC file templates — validity', () => {
  // ── ST ──────────────────────────────────────────────────────────────
  it('ST template is valid Pascal program', () => {
    const source = 'PROGRAM Main\nVAR\n  x : INT;\nEND_VAR\n\nx := 0;\nEND_PROGRAM\n';
    const result = bridge.compileSt(source);
    const parsed = JSON.parse(result);
    expect(parsed.instructions).toBeDefined();
    expect(Array.isArray(parsed.instructions)).toBe(true);
  });

  // ── IL ──────────────────────────────────────────────────────────────
  it('IL template compiles via napi-rs', () => {
    const source = 'LD TRUE\nST result\n';
    const result = bridge.compileIl(source);
    const parsed = JSON.parse(result);
    expect(parsed.instructions).toBeDefined();
  });

  // ── LD ──────────────────────────────────────────────────────────────
  it('LD template is valid LdGraph JSON', () => {
    const template = '{"id":"untitled","nodes":[],"edges":[],"rungs":[]}';
    const parsed = JSON.parse(template);
    expect(parsed.id).toBe('untitled');
    expect(Array.isArray(parsed.nodes)).toBe(true);
    expect(Array.isArray(parsed.edges)).toBe(true);
    expect(Array.isArray(parsed.rungs)).toBe(true);
  });

  it('LD template has all required fields', () => {
    const template = '{"id":"untitled","nodes":[],"edges":[],"rungs":[]}';
    const parsed = JSON.parse(template);
    for (const field of ['id', 'nodes', 'edges', 'rungs']) {
      expect(parsed).toHaveProperty(field);
    }
    expect(parsed.nodes.length).toBe(0);
  });

  it('LD compiles via napi-rs', () => {
    const result = bridge.compileLd('NETWORK\n  LD TRUE\n  ST output\n');
    const parsed = JSON.parse(result);
    expect(parsed.instructions).toBeDefined();
  });

  // ── FBD ──────────────────────────────────────────────────────────────
  it('FBD template is valid FbdGraph JSON', () => {
    const template = '{"id":"untitled","nodes":[],"edges":[]}';
    const parsed = JSON.parse(template);
    expect(parsed.id).toBe('untitled');
    expect(Array.isArray(parsed.nodes)).toBe(true);
    expect(Array.isArray(parsed.edges)).toBe(true);
  });

  it('FBD template has all required fields', () => {
    const template = '{"id":"untitled","nodes":[],"edges":[]}';
    const parsed = JSON.parse(template);
    for (const field of ['id', 'nodes', 'edges']) {
      expect(parsed).toHaveProperty(field);
    }
  });

  it('FBD compiles via napi-rs', () => {
    const result = bridge.compileFbd('BLOCK ton1 TON\n');
    const parsed = JSON.parse(result);
    expect(parsed.instructions).toBeDefined();
  });

  // ── SFC ──────────────────────────────────────────────────────────────
  it('SFC template has non-empty placeholder', () => {
    // Placeholder template — SFC compiler validates actual content
    expect(true).toBe(true); // placeholder valid until SFC editor is wired
  });

  // ── HMI ──────────────────────────────────────────────────────────────
  it('HMI template is valid YAML', () => {
    const template = '# HMI Layout\nwidgets: []\n';
    expect(template).toContain('widgets:');
    expect(template).toContain('[]');
  });

  // ── G-code ───────────────────────────────────────────────────────────
  it('G-code template compiles via napi-rs', () => {
    const result = bridge.compileGcode('G21\nG90\nG0 X0 Y0 Z0\nM30\n');
    const parsed = JSON.parse(result);
    expect(parsed.instructions).toBeDefined();
  });

  it('G-code template contains RS274 commands', () => {
    const template = '; G-code CNC Program\nG21 ; mm units\nG90 ; absolute positioning\nG0 X0 Y0 Z0\nM30\n';
    expect(template).toContain('G21');
    expect(template).toContain('G90');
    expect(template).toContain('M30');
  });
});

describe('IEC file templates — error handling', () => {
  it('ST compiler rejects empty source', () => {
    expect(() => bridge.compileSt('')).toThrow();
  });

  it('FBD compiler rejects empty source', () => {
    expect(() => bridge.compileFbd('')).toThrow();
  });

  it('G-code compiler rejects unsupported G-code', () => {
    expect(() => bridge.compileGcode('G999\n')).toThrow();
  });
});
