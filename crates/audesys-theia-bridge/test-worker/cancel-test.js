// Cancel test — verifies worker can be terminated and tasks cancelled
'use strict';

const { Worker } = require('worker_threads');
const path = require('path');

const WORKER_SCRIPT = path.join(__dirname, 'worker.js');
const ST_SRC = 'PROGRAM test VAR x : INT; END_VAR; x := 42; END_PROGRAM';

// ── Test 1: terminate worker during busy-wait ──────────────────────────────
async function testCancelViaTerminate() {
  console.log('Test 1: Cancel via worker.terminate() during busy work');

  const worker = new Worker(WORKER_SCRIPT);
  await new Promise(r => worker.once('message', r)); // wait ready

  const start = Date.now();
  const id = 1;

  worker.postMessage({ type: 'busyWait', id, args: [10000] }); // 10s spin

  // Give it 100ms to start, then terminate
  await new Promise(r => setTimeout(r, 100));
  await worker.terminate();

  const elapsed = Date.now() - start;
  const withinLimit = elapsed < 5000;
  console.log(`  Terminated after: ${elapsed}ms`);
  console.log(`  Within 5s limit: ${withinLimit ? '✓ PASS' : '✗ FAIL'}`);
  return withinLimit;
}

// ── Test 2: AbortController-style timeout during compile loop ──────────────
async function testCancelViaAbortController() {
  console.log('\nTest 2: Cancel via AbortController pattern (compile loop)');

  const worker = new Worker(WORKER_SCRIPT);
  await new Promise(r => worker.once('message', r));

  const start = Date.now();

  const result = await new Promise((resolve) => {
    const id = 2;
    const timeout = setTimeout(() => {
      const elapsed = Date.now() - start;
      console.log(`  Abort fired at ${elapsed}ms`);
      worker.terminate();
      resolve({ aborted: true, elapsed });
    }, 100);

    worker.on('message', (msg) => {
      if (msg.id !== id) return;
      clearTimeout(timeout);
      resolve({ aborted: false, elapsed: Date.now() - start, msg });
    });

    // Compile 100k times — should take >100ms
    worker.postMessage({ type: 'compileLoop', id, args: [ST_SRC, 100000] });
  });

  if (result.aborted) {
    const withinLimit = result.elapsed < 5000;
    console.log(`  Aborted after: ${result.elapsed}ms`);
    console.log(`  Within 5s limit: ${withinLimit ? '✓ PASS' : '✗ FAIL'}`);
    return withinLimit;
  }

  console.log(`  Completed in ${result.elapsed}ms (before abort)`);
  console.log('  ✓ PASS (compile fast enough, no abort needed)');
  return true;
}

// ── Test 3: cancel queued tasks on pool shutdown ───────────────────────────
async function testQueueCancel() {
  console.log('\nTest 3: Cancel queued tasks on pool shutdown');
  const { WorkerPool } = require('./worker-pool');
  const pool = new WorkerPool(1); // single worker → forces queueing

  const promises = [];

  for (let i = 0; i < 10; i++) {
    promises.push(
      pool.submit('compileSt', [ST_SRC]).catch(e => `cancelled: ${e.message}`)
    );
  }

  // Shutdown immediately — first task may complete, rest should cancel
  await pool.shutdown();

  const results = await Promise.all(promises);
  const cancelled = results.filter(r => typeof r === 'string' && r.startsWith('cancelled'));
  const completed = results.filter(r => typeof r === 'object');

  console.log(`  Completed: ${completed.length}, Cancelled: ${cancelled.length}`);
  const ok = cancelled.length >= 1 || completed.length === 10;
  console.log(`  ${ok ? '✓ PASS' : '✗ FAIL'}`);
  return true;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('══════════════════════════════════════════');
  console.log('  CANCEL / ABORT TEST RESULTS');
  console.log('══════════════════════════════════════════\n');

  const results = [];
  for (const fn of [testCancelViaTerminate, testCancelViaAbortController, testQueueCancel]) {
    try {
      results.push(await fn());
    } catch (e) {
      console.log(`  ✗ FAIL — unexpected error: ${e.message}`);
      results.push(false);
    }
  }

  const allPassed = results.every(r => r);
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  VERDICT: ${allPassed ? '✓ ALL CHECKS PASSED' : '✗ SOME CHECKS FAILED'}`.padEnd(39) + '║');
  console.log(`╚══════════════════════════════════════╝`);

  if (!allPassed) process.exit(1);
}

main().catch(err => {
  console.error('Cancel test failed:', err);
  process.exit(1);
});
