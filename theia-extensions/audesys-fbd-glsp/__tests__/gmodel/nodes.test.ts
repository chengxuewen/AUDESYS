/**
 * Unit tests for FBD GModel node types and helpers.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  GateNode,
  GateType,
  FunctionBlockNode,
  Pin,
  PinDirection,
  BaseNode,
  Point,
  isGateNode,
  isFunctionBlockNode,
  getInputPorts,
  getOutputPorts,
  findPin,
  GATE_DEFAULT_SIZES,
} from '../../src/gmodel/nodes';
import {
  createGate,
  createFB,
  createInputPin,
  createOutputPin,
  resetIdCounter,
} from '../../src/gmodel/model';

beforeEach(() => {
  resetIdCounter();
});

// ── Gate Creation ────────────────────────────────────────────────────

describe('createGate', () => {
  it('creates an AND gate with 2 input pins and 1 output pin', () => {
    const gate = createGate(GateType.AND, { x: 100, y: 200 });

    expect(gate.type).toBe('node:gate');
    expect(gate.gateType).toBe(GateType.AND);
    expect(gate.position).toEqual({ x: 100, y: 200 });
    expect(gate.inputPorts).toHaveLength(2);
    expect(gate.outputPorts).toHaveLength(1);
    expect(gate.inputPorts[0].name).toBe('IN1');
    expect(gate.inputPorts[1].name).toBe('IN2');
    expect(gate.outputPorts[0].name).toBe('OUT');
    // All pins should be BOOL for gates
    gate.inputPorts.forEach((p) => expect(p.dataType).toBe('BOOL'));
    expect(gate.outputPorts[0].dataType).toBe('BOOL');
    expect(gate.size).toEqual(GATE_DEFAULT_SIZES[GateType.AND]);
  });

  it('creates an OR gate with correct pins', () => {
    const gate = createGate(GateType.OR);

    expect(gate.gateType).toBe(GateType.OR);
    expect(gate.inputPorts).toHaveLength(2);
    expect(gate.outputPorts).toHaveLength(1);
    expect(gate.inputPorts.map((p) => p.name)).toEqual(['IN1', 'IN2']);
  });

  it('creates a XOR gate with correct pins', () => {
    const gate = createGate(GateType.XOR);

    expect(gate.gateType).toBe(GateType.XOR);
    expect(gate.inputPorts).toHaveLength(2);
    expect(gate.outputPorts).toHaveLength(1);
  });

  it('creates a NOT gate with 1 input pin and 1 output pin', () => {
    const gate = createGate(GateType.NOT);

    expect(gate.gateType).toBe(GateType.NOT);
    expect(gate.inputPorts).toHaveLength(1);
    expect(gate.inputPorts[0].name).toBe('IN');
    expect(gate.outputPorts).toHaveLength(1);
    expect(gate.outputPorts[0].name).toBe('OUT');
    expect(gate.size).toEqual(GATE_DEFAULT_SIZES[GateType.NOT]);
  });

  it('creates a MUX gate with SEL+IN0+IN1 input pins', () => {
    const gate = createGate(GateType.MUX);

    expect(gate.gateType).toBe(GateType.MUX);
    expect(gate.inputPorts).toHaveLength(3);
    expect(gate.inputPorts.map((p) => p.name)).toEqual(['SEL', 'IN0', 'IN1']);
    expect(gate.outputPorts).toHaveLength(1);
    expect(gate.size).toEqual(GATE_DEFAULT_SIZES[GateType.MUX]);
  });

  it('defaults position to {0,0} when not specified', () => {
    const gate = createGate(GateType.AND);

    expect(gate.position).toEqual({ x: 0, y: 0 });
  });

  it('generates unique IDs via resetIdCounter', () => {
    const gate1 = createGate(GateType.AND);
    resetIdCounter();
    const gate2 = createGate(GateType.AND);

    expect(gate1.id).toBe('gate-1');
    expect(gate2.id).toBe('gate-1');
  });
});

// ── Function Block Creation ──────────────────────────────────────────

describe('createFB', () => {
  it('creates a function block with custom input/output pins', () => {
    const inPins: Pin[] = [
      createInputPin('IN', 'BOOL', 0, 2),
      createInputPin('PT', 'INT', 1, 2),
    ];
    const outPins: Pin[] = [
      createOutputPin('Q', 'BOOL', 120, 0, 2),
      createOutputPin('ET', 'INT', 120, 1, 2),
    ];

    const fb = createFB('TON', inPins, outPins, { x: 50, y: 100 });

    expect(fb.type).toBe('node:fb');
    expect(fb.fbType).toBe('TON');
    expect(fb.position).toEqual({ x: 50, y: 100 });
    expect(fb.inputPorts).toHaveLength(2);
    expect(fb.outputPorts).toHaveLength(2);
    expect(fb.inputPorts[0].name).toBe('IN');
    expect(fb.inputPorts[1].name).toBe('PT');
    expect(fb.outputPorts[0].name).toBe('Q');
    expect(fb.outputPorts[1].name).toBe('ET');
    // Dimensions
    expect(fb.size.width).toBe(120);
    expect(fb.size.height).toBeGreaterThanOrEqual(60);
  });

  it('calculates height from pin count', () => {
    const inPins = Array.from({ length: 5 }, (_, i) =>
      createInputPin(`IN${i + 1}`, 'BOOL', i, 5),
    );
    const outPins = [createOutputPin('OUT', 'BOOL', 120, 0, 1)];

    const fb = createFB('BIG', inPins, outPins);

    // 5 pins × 28 + 16 = 156
    expect(fb.size.height).toBeGreaterThanOrEqual(60);
  });
});

// ── Pin Direction ────────────────────────────────────────────────────

describe('PinDirection', () => {
  it('has three valid directions', () => {
    expect(PinDirection.Input).toBe('Input');
    expect(PinDirection.Output).toBe('Output');
    expect(PinDirection.Bidi).toBe('Bidi');
  });
});

describe('createInputPin', () => {
  it('creates an Input pin with correct direction and position', () => {
    const pin = createInputPin('IN1', 'BOOL', 0, 2);

    expect(pin.name).toBe('IN1');
    expect(pin.dataType).toBe('BOOL');
    expect(pin.direction).toBe(PinDirection.Input);
    expect(pin.position.x).toBe(0);
  });

  it('positions multiple input pins vertically', () => {
    const pin0 = createInputPin('IN1', 'BOOL', 0, 3);
    const pin2 = createInputPin('IN3', 'BOOL', 2, 3);

    // pin2 should be below pin0
    expect(pin2.position.y).toBeGreaterThan(pin0.position.y);
  });
});

describe('createOutputPin', () => {
  it('creates an Output pin with correct direction and block-width alignment', () => {
    const pin = createOutputPin('OUT', 'BOOL', 60, 0, 1);

    expect(pin.name).toBe('OUT');
    expect(pin.dataType).toBe('BOOL');
    expect(pin.direction).toBe(PinDirection.Output);
    expect(pin.position.x).toBe(60);
  });
});

// ── Type Guards ──────────────────────────────────────────────────────

describe('type guards', () => {
  it('isGateNode returns true for gate nodes', () => {
    const gate = createGate(GateType.AND);
    expect(isGateNode(gate)).toBe(true);
  });

  it('isGateNode returns false for FB nodes', () => {
    const fb = createFB('TON', [], []);
    expect(isGateNode(fb)).toBe(false);
  });

  it('isFunctionBlockNode returns true for FB nodes', () => {
    const fb = createFB('TON', [], []);
    expect(isFunctionBlockNode(fb)).toBe(true);
  });

  it('isFunctionBlockNode returns false for gate nodes', () => {
    const gate = createGate(GateType.AND);
    expect(isFunctionBlockNode(gate)).toBe(false);
  });
});

// ── Pin Helpers ──────────────────────────────────────────────────────

describe('getInputPorts', () => {
  it('returns input ports for a gate', () => {
    const gate = createGate(GateType.AND);
    const ports = getInputPorts(gate);
    expect(ports).toHaveLength(2);
    expect(ports.map((p) => p.name)).toEqual(['IN1', 'IN2']);
  });

  it('returns input ports for an FB', () => {
    const fb = createFB('TON',
      [createInputPin('EN', 'BOOL', 0, 1)],
      [],
    );
    const ports = getInputPorts(fb);
    expect(ports).toHaveLength(1);
  });

  it('returns empty array for unknown node type', () => {
    const node: BaseNode = {
      id: 'x', type: 'node:unknown',
      position: { x: 0, y: 0 }, size: { width: 50, height: 50 },
    };
    expect(getInputPorts(node)).toEqual([]);
  });
});

describe('getOutputPorts', () => {
  it('returns output ports for a gate', () => {
    const gate = createGate(GateType.NOT);
    const ports = getOutputPorts(gate);
    expect(ports).toHaveLength(1);
    expect(ports[0].name).toBe('OUT');
  });
});

describe('findPin', () => {
  it('finds a pin by name on a gate', () => {
    const gate = createGate(GateType.AND);
    const pin = findPin(gate, 'IN1');
    expect(pin).toBeDefined();
    expect(pin!.name).toBe('IN1');
  });

  it('returns undefined for non-existent pin', () => {
    const gate = createGate(GateType.AND);
    expect(findPin(gate, 'NONEXISTENT')).toBeUndefined();
  });

  it('finds output pins', () => {
    const gate = createGate(GateType.AND);
    const pin = findPin(gate, 'OUT');
    expect(pin).toBeDefined();
    expect(pin!.direction).toBe(PinDirection.Output);
  });
});

// ── Gate Type Enum ───────────────────────────────────────────────────

describe('GateType', () => {
  it('has all five gate types', () => {
    expect(GateType.AND).toBe('AND');
    expect(GateType.OR).toBe('OR');
    expect(GateType.XOR).toBe('XOR');
    expect(GateType.NOT).toBe('NOT');
    expect(GateType.MUX).toBe('MUX');
  });
});
