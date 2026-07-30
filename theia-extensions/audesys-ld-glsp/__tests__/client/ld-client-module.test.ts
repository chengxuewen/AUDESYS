/**
 * Unit tests for LD GLSP Client Module — LD_NODE_TYPES, source imports, and exports.
 *
 * Reference: T4.2 from glsp-editor-hardening plan.
 */
import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock inversify to avoid DI container instantiation
vi.mock('@theia/core/shared/inversify', () => ({
  Container: vi.fn(),
  ContainerModule: class ContainerModule {
    constructor(_cb: unknown) {}
  },
  injectable: () => (target: unknown) => target,
}));

// Mock @eclipse-glsp/client to avoid Sprotty dependency
vi.mock('@eclipse-glsp/client', () => ({
  configureDefaultModelElements: vi.fn(),
  configureModelElement: vi.fn(),
  GNode: class GNode {},
  SEdgeImpl: class SEdgeImpl {},
  SGraphImpl: class SGraphImpl {},
  PolylineEdgeView: class PolylineEdgeView {},
  SGraphView: class SGraphView {},
  selectFeature: 'selectFeature',
  moveFeature: 'moveFeature',
  deletableFeature: 'deletableFeature',
  boundsFeature: 'boundsFeature',
  viewportFeature: 'viewportFeature',
  fadeFeature: 'fadeFeature',
  hoverFeedbackFeature: 'hoverFeedbackFeature',
  popupFeature: 'popupFeature',
}));

// Mock the views to avoid rendering dependency
vi.mock('../../src/client/ld-gmodel-views', () => ({
  LdContactView: class LdContactView {},
  LdCoilView: class LdCoilView {},
  LdPowerRailView: class LdPowerRailView {},
  LdFbView: class LdFbView {},
}));

// Now we can import the module
import { LD_NODE_TYPES, resetCounters } from '../../src/client/ld-glsp-client-module';

// ============================================================================
// LD_NODE_TYPES — completeness and correctness
// ============================================================================

describe('LD_NODE_TYPES', () => {
  it('has all 7 expected node type entries', () => {
    expect(Object.keys(LD_NODE_TYPES)).toEqual([
      'GRAPH',
      'CONTACT',
      'COIL',
      'POWERRAIL',
      'FB',
      'WIRE',
      'POWER',
    ]);
  });

  it('GRAPH is "graph"', () => {
    expect(LD_NODE_TYPES.GRAPH).toBe('graph');
  });

  it('CONTACT is "node:contact"', () => {
    expect(LD_NODE_TYPES.CONTACT).toBe('node:contact');
  });

  it('COIL is "node:coil"', () => {
    expect(LD_NODE_TYPES.COIL).toBe('node:coil');
  });

  it('POWERRAIL is "node:powerrail"', () => {
    expect(LD_NODE_TYPES.POWERRAIL).toBe('node:powerrail');
  });

  it('FB is "node:fb"', () => {
    expect(LD_NODE_TYPES.FB).toBe('node:fb');
  });

  it('WIRE is "edge:wire"', () => {
    expect(LD_NODE_TYPES.WIRE).toBe('edge:wire');
  });

  it('POWER is "edge:power"', () => {
    expect(LD_NODE_TYPES.POWER).toBe('edge:power');
  });
});

// ============================================================================
// D101: No direct imports from 'sprotty'
// ============================================================================

describe('D101: no direct imports from sprotty', () => {
  it('ld-glsp-client-module.ts does not import from sprotty directly', () => {
    const srcPath = path.resolve(__dirname, '../../src/client/ld-glsp-client-module.ts');
    const content = fs.readFileSync(srcPath, 'utf-8');

    const hasDirectSprottyImport = /from\s+['"]sprotty['"]/.test(content);
    expect(hasDirectSprottyImport).toBe(false);

    const hasGlspClientImport = content.includes("from '@eclipse-glsp/client'");
    expect(hasGlspClientImport).toBe(true);
  });
});

// ============================================================================
// Exported functions
// ============================================================================

describe('exported functions', () => {
  it('resetCounters is exported and works', () => {
    expect(typeof resetCounters).toBe('function');
    expect(() => resetCounters()).not.toThrow();
  });
});

// ============================================================================
// configureDefaultModelElements integration
// ============================================================================

describe('configureDefaultModelElements', () => {
  it('is called during module initialization (SGraphView registered)', () => {
    const srcPath = path.resolve(__dirname, '../../src/client/ld-glsp-client-module.ts');
    const content = fs.readFileSync(srcPath, 'utf-8');

    expect(content).toContain('configureDefaultModelElements(context)');
    expect(content).toContain('SGraphView');
    expect(content).toContain("import {");
    expect(content).toContain('SGraphImpl, SGraphView');
  });
});
