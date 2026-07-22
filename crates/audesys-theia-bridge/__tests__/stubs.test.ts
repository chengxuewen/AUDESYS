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
