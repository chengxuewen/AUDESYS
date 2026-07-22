import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bridge = require('../index.js');

describe('stubs', () => {
  it('compileFbd throws not-implemented', () => {
    expect(() => bridge.compileFbd('SOME FBD')).toThrow('not implemented');
  });

  it('compileSfc throws not-implemented', () => {
    expect(() => bridge.compileSfc('STEP step1: N S1; END_STEP')).toThrow(
      'not implemented',
    );
  });

  it('compileGcode throws not-implemented', () => {
    expect(() => bridge.compileGcode('G0 X10 Y20')).toThrow('not implemented');
  });

  it('deployHmiLayout throws not-implemented', () => {
    expect(() =>
      bridge.deployHmiLayout('/tmp/sock', 'secret', 'layout: {}'),
    ).toThrow('not implemented');
  });

  it('loadHalConfig throws not-implemented', () => {
    expect(() =>
      bridge.loadHalConfig('/tmp/sock', 'secret', 'config: {}'),
    ).toThrow('not implemented');
  });

  it('debugConnect throws not-implemented', () => {
    expect(() => bridge.debugConnect('/tmp/sock', 'secret')).toThrow(
      'not implemented',
    );
  });

  it('simCreate throws not-implemented', () => {
    expect(() => bridge.simCreate(100)).toThrow('not implemented');
  });

  it('openProject throws not-implemented', () => {
    expect(() => bridge.openProject('/tmp/project')).toThrow('not implemented');
  });

  it('readProjectFile throws not-implemented', () => {
    expect(() => bridge.readProjectFile('/tmp/file.st')).toThrow(
      'not implemented',
    );
  });

  it('saveHmiLayout throws not-implemented', () => {
    expect(() => bridge.saveHmiLayout('/tmp/layout.yaml', 'layout: {}')).toThrow(
      'not implemented',
    );
  });

  it('loadHmiLayout throws not-implemented', () => {
    expect(() => bridge.loadHmiLayout('/tmp/layout.yaml')).toThrow(
      'not implemented',
    );
  });
});

// ── Additional edge-case tests for stubs ──────────────────────────

describe('stubs — edge cases', () => {
  it('compileFbd throws with empty source', () => {
    expect(() => bridge.compileFbd('')).toThrow('not implemented');
  });

  it('compileFbd throws with null-like content', () => {
    expect(() => bridge.compileFbd('undefined')).toThrow('not implemented');
  });

  it('compileGcode throws with empty source', () => {
    expect(() => bridge.compileGcode('')).toThrow('not implemented');
  });

  it('compileGcode throws with partial command', () => {
    expect(() => bridge.compileGcode('G')).toThrow('not implemented');
  });

  it('compileSfc throws with empty source', () => {
    expect(() => bridge.compileSfc('')).toThrow('not implemented');
  });

  it('compileSfc throws with bogus input', () => {
    expect(() => bridge.compileSfc('not a step')).toThrow('not implemented');
  });

  it('openProject throws with empty path', () => {
    expect(() => bridge.openProject('')).toThrow('not implemented');
  });

  it('openProject throws with null-like path', () => {
    expect(() => bridge.openProject('.')).toThrow('not implemented');
  });

  it('readProjectFile throws with empty path', () => {
    expect(() => bridge.readProjectFile('')).toThrow('not implemented');
  });

  it('readProjectFile throws with extensionless path', () => {
    expect(() => bridge.readProjectFile('config')).toThrow('not implemented');
  });

  it('saveHmiLayout throws with empty path', () => {
    expect(() => bridge.saveHmiLayout('', 'layout: {}')).toThrow('not implemented');
  });

  it('saveHmiLayout throws with empty content', () => {
    expect(() => bridge.saveHmiLayout('/tmp/test.yaml', '')).toThrow('not implemented');
  });

  it('loadHmiLayout throws with empty path', () => {
    expect(() => bridge.loadHmiLayout('')).toThrow('not implemented');
  });

  it('loadHmiLayout throws with relative path', () => {
    expect(() => bridge.loadHmiLayout('./layout.yaml')).toThrow('not implemented');
  });

  it('deployHmiLayout throws with empty path', () => {
    expect(() => bridge.deployHmiLayout('', '', 'yaml: content')).toThrow('not implemented');
  });

  it('loadHalConfig throws with empty config', () => {
    expect(() => bridge.loadHalConfig('/tmp/sock', 'secret', '')).toThrow('not implemented');
  });
});
