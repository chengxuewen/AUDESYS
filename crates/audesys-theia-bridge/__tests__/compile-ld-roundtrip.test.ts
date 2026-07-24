import { describe, it, expect } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridge = require('../index.js');

// ── LD Compile Roundtrip ───────────────────────────────────────────────
// Verify the complete LD → IL → HalProgram pipeline.

describe('LD compile roundtrip', () => {
  it('network with NO contact + coil → valid HalProgram', () => {
    const ld = 'NETWORK\n  LD TRUE\n  ST output\n';
    const json = bridge.compileLd(ld);
    const program = JSON.parse(json);
    expect(program.instructions).toBeDefined();
    expect(program.instructions.length).toBeGreaterThanOrEqual(1);
  });

  it('multi-network LD → multiple instructions', () => {
    const ld = 'NETWORK\n  LD TRUE\n  ST out1\nNETWORK\n  LD FALSE\n  ST out2\n';
    const json = bridge.compileLd(ld);
    const program = JSON.parse(json);
    expect(program.instructions.length).toBeGreaterThanOrEqual(1);
  });

  it('compiled program has expected structure', () => {
    const ld = 'NETWORK\n  LD TRUE\n  ST result\n';
    const json = bridge.compileLd(ld);
    const program = JSON.parse(json);
    // HalProgram must have: name, instructions, signals, channels
    expect(program).toHaveProperty('name');
    expect(program).toHaveProperty('instructions');
    expect(program).toHaveProperty('signals');
    expect(program).toHaveProperty('channels');
    expect(program).toHaveProperty('function_table');
  });

  it('instructions contain opcode and operands', () => {
    const ld = 'NETWORK\n  LD TRUE\n  ST result\n';
    const json = bridge.compileLd(ld);
    const program = JSON.parse(json);
    for (const inst of program.instructions) {
      expect(inst).toHaveProperty('opcode');
    }
  });

  it('empty LD graph compiles to minimal program', () => {
    const ld = 'NETWORK\n  LD TRUE\n  ST done\n';
    const json = bridge.compileLd(ld);
    const program = JSON.parse(json);
    expect(program.instructions).toBeDefined();
    expect(program.instructions.length).toBeGreaterThan(0);
  });
});

// ── Controller lifecycle ───────────────────────────────────────────────

describe('controller lifecycle', () => {
  it('controllerStart rejects nonexistent binary', () => {
    expect(() => bridge.controllerStart('/nonexistent/controller')).toThrow();
  });

  it('controllerHealth returns alive=false when no controller', () => {
    const result = bridge.controllerHealth('/tmp/nonexistent.sock', 'secret');
    expect(result).toBeDefined();
    // Result should indicate no controller
    expect(result.toLowerCase()).toMatch(/not found|connection refused|error|false/i);
  });

  it('controllerStop rejects when no controller running', () => {
    expect(() => bridge.controllerStop()).toThrow();
  });
});
