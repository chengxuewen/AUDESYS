/**
 * Unit tests for LD GModel node factory functions and types.
 */
import { describe, it, expect } from 'vitest';
import {
  createContact,
  createCoil,
  createPowerRail,
  createFb,
} from '../../src/gmodel/model';
import {
  ContactType,
  CoilType,
  PowerRailSide,
  FbPlaceholderNode,
  Pin,
} from '../../src/gmodel/nodes';

// ============================================================================
// ContactNode
// ============================================================================

describe('createContact', () => {
  it('creates a valid ContactNode with all required fields', () => {
    const contact = createContact(ContactType.NO, 'X1', { x: 100, y: 40 });

    expect(contact.type).toBe('node:contact');
    expect(contact.contactType).toBe(ContactType.NO);
    expect(contact.variableName).toBe('X1');
    expect(contact.position).toEqual({ x: 100, y: 40 });
    expect(contact.size).toEqual({ width: 36, height: 36 });
    expect(contact.id).toMatch(/^contact-\d+$/);
  });

  it('defaults position to origin when not provided', () => {
    const contact = createContact(ContactType.NC, 'stop_btn');

    expect(contact.position).toEqual({ x: 0, y: 0 });
    expect(contact.contactType).toBe(ContactType.NC);
  });
});

// ============================================================================
// CoilNode
// ============================================================================

describe('createCoil', () => {
  it('creates a valid CoilNode with default Normal type', () => {
    const coil = createCoil(CoilType.Normal, 'Y1', { x: 300, y: 40 });

    expect(coil.type).toBe('node:coil');
    expect(coil.coilType).toBe(CoilType.Normal);
    expect(coil.variableName).toBe('Y1');
    expect(coil.position).toEqual({ x: 300, y: 40 });
    expect(coil.size).toEqual({ width: 36, height: 36 });
    expect(coil.id).toMatch(/^coil-\d+$/);
  });

  it('CoilType enum includes all 4 types', () => {
    const types = Object.values(CoilType);
    expect(types).toHaveLength(4);
    expect(types).toEqual(expect.arrayContaining([
      CoilType.Normal,
      CoilType.Negated,
      CoilType.Set,
      CoilType.Reset,
    ]));
  });

  it('creates coils for each CoilType variant', () => {
    for (const coilType of Object.values(CoilType)) {
      const coil = createCoil(coilType, 'Y');
      expect(coil.coilType).toBe(coilType);
    }
  });
});

// ============================================================================
// PowerRailNode
// ============================================================================

describe('createPowerRail', () => {
  it('creates a valid left PowerRailNode', () => {
    const rail = createPowerRail(PowerRailSide.Left, { x: 0, y: 0 }, 600);

    expect(rail.type).toBe('node:powerrail');
    expect(rail.side).toBe(PowerRailSide.Left);
    expect(rail.position).toEqual({ x: 0, y: 0 });
    expect(rail.size).toEqual({ width: 4, height: 600 });
    expect(rail.id).toMatch(/^powerrail-\d+$/);
  });

  it('creates a right PowerRailNode with default height', () => {
    const rail = createPowerRail(PowerRailSide.Right);

    expect(rail.side).toBe(PowerRailSide.Right);
    expect(rail.size.height).toBe(600);
    expect(rail.position).toEqual({ x: 0, y: 0 });
  });
});

// ============================================================================
// FbPlaceholderNode
// ============================================================================

describe('FbPlaceholderNode', () => {
  it('creates with inputPins and outputPins', () => {
    const enPin: Pin = { name: 'EN', dataType: 'BOOL', position: { x: 0, y: 0 } };
    const in1Pin: Pin = { name: 'IN1', dataType: 'INT', position: { x: 0, y: 20 } };
    const enoPin: Pin = { name: 'ENO', dataType: 'BOOL', position: { x: 120, y: 0 } };
    const outPin: Pin = { name: 'OUT', dataType: 'INT', position: { x: 120, y: 20 } };

    const fb = createFb(
      'TON',
      [enPin, in1Pin],
      [enoPin, outPin],
      { x: 200, y: 80 },
    );

    expect(fb.type).toBe('node:fb');
    expect(fb.fbType).toBe('TON');
    expect(fb.position).toEqual({ x: 200, y: 80 });
    expect(fb.size).toEqual({ width: 120, height: 80 });
    expect(fb.inputPins).toHaveLength(2);
    expect(fb.outputPins).toHaveLength(2);
    expect(fb.inputPins[0]).toEqual(enPin);
    expect(fb.outputPins[1].name).toBe('OUT');
    expect(fb.id).toMatch(/^fb-\d+$/);
  });

  it('creates with empty pins and defaults position', () => {
    const fb = createFb('CTU', [], []);

    expect(fb.fbType).toBe('CTU');
    expect(fb.inputPins).toHaveLength(0);
    expect(fb.outputPins).toHaveLength(0);
    expect(fb.position).toEqual({ x: 0, y: 0 });
  });
});
