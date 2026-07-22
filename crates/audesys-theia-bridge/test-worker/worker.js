// Worker entry: loads napi-rs native binding and handles RPC via MessagePort
'use strict';

const { parentPort } = require('worker_threads');

// Load native binding — relative to this file (test-worker/worker.js → ../index.js)
const bridge = require('../index.js');

// Map function names to bridge exports for dynamic dispatch
const FNS = {
  compileSt:     (src) => bridge.compileSt(src),
  compileIl:     (src) => bridge.compileIl(src),
  compileLd:     (src) => bridge.compileLd(src),
  compileFbd:    (src) => bridge.compileFbd(src),
  compileSfc:    (src) => bridge.compileSfc(src),
  compileGcode:  (src) => bridge.compileGcode(src),
  readSignal:    (socketPath, secret, signalName) =>
    bridge.readSignal(socketPath, secret, signalName),
  deployProgram: (socketPath, secret, json) =>
    bridge.deployProgram(socketPath, secret, json),
  healthQuery:   (socketPath, secret) =>
    bridge.healthQuery(socketPath, secret),
  busyWait:     (ms) => {
    // Busy-spin for `ms` milliseconds — used by cancel-test
    const end = Date.now() + ms;
    while (Date.now() < end) { /* spin */ }
    return 'done';
  },
  compileLoop:  (src, count) => {
    // Compile `src` `count` times — used to produce sustained worker load
    for (let i = 0; i < count; i++) {
      bridge.compileSt(src);
    }
    return 'done';
  },
};

parentPort.on('message', ({ type, id, args }) => {
  const fn = FNS[type];
  if (!fn) {
    parentPort.postMessage({ id, error: `unknown function: ${type}` });
    return;
  }

  try {
    const start = process.hrtime.bigint();
    const result = fn(...args);
    const elapsedNs = Number(process.hrtime.bigint() - start);
    parentPort.postMessage({ id, result, elapsedNs });
  } catch (err) {
    parentPort.postMessage({ id, error: err.message });
  }
});

// Signal readiness
parentPort.postMessage({ ready: true });
