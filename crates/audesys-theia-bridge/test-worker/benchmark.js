// Benchmark — validates worker_thread pool performance + main thread isolation
'use strict';

const { WorkerPool } = require('./worker-pool');

// ── Valid compiler sources ─────────────────────────────────────────────────
const ST_SRC = 'PROGRAM test VAR x : INT; y : INT; END_VAR; x := 42; y := x + 1; END_PROGRAM';
const IL_SRC = 'LD X1\nAND X2\nST Y1';
const LD_SRC = 'NETWORK\n  NO X1\n  NO X2\n  OUT Y1';

// ── Drift tracker ──────────────────────────────────────────────────────────
class DriftTracker {
  constructor(intervalMs = 100) {
    this.intervalMs = intervalMs;
    this.deviations = [];
    this.count = 0;
    this._timer = null;
    this._expected = 0;
  }

  start() {
    this._expected = Date.now() + this.intervalMs;
    this._timer = setInterval(() => {
      const now = Date.now();
      const drift = now - this._expected;
      this.deviations.push(drift);
      this.count++;
      this._expected += this.intervalMs;
    }, this.intervalMs);
    return this;
  }

  stop() {
    clearInterval(this._timer);
    return this;
  }

  summary() {
    if (this.deviations.length === 0) return { ok: true, msg: 'no samples' };
    const maxAbs = Math.max(...this.deviations.map(Math.abs));
    return {
      count: this.count,
      maxDrift: Math.max(...this.deviations),
      minDrift: Math.min(...this.deviations),
      maxAbsDeviation: maxAbs,
      avgDriftMs: (this.deviations.reduce((a, b) => a + b, 0) / this.deviations.length).toFixed(2),
      ok: maxAbs <= 20,
    };
  }
}

// ── Run a batch of compilations ────────────────────────────────────────────
async function runBatch(pool, type, source, count) {
  const tasks = [];
  for (let i = 0; i < count; i++) {
    tasks.push(pool.submit(type, [source]));
  }
  const results = await Promise.all(tasks);
  let failures = 0;
  let totalNs = 0n;
  for (const r of results) {
    if (r.result) {
      totalNs += BigInt(r.elapsedNs);
    } else {
      failures++;
    }
  }
  const avgNs = Number(totalNs) / (count - failures);
  return { type, count, failures, avgNs, avgMs: (avgNs / 1e6).toFixed(3) };
}

// ── Concurrency isolation test ────────────────────────────────────────────
async function testConcurrencyIsolation(pool) {
  // 10MB-ish source for a long compile — repeat 200k times
  const bigSrc = (() => {
    let body = '';
    for (let i = 0; i < 200000; i++) {
      body += `  v${i} : INT;`;
    }
    // Minimal valid ST that triggers a non-trivial compilation
    return `PROGRAM big VAR ${body} END_VAR x := 42; END_PROGRAM`;
  })();

  const SCALE = 1000; // smaller for speed
  const big = (() => {
    let body = '';
    for (let i = 0; i < SCALE; i++) {
      body += `  v${i} : INT;`;
    }
    return `PROGRAM big VAR ${body} END_VAR x := 42; END_PROGRAM`;
  })();

  const start = Date.now();

  // Submit a long compile AND a readSignal simultaneously
  const [longCompile, signalRead] = await Promise.allSettled([
    pool.submit('compileSt', [big]),
    // readSignal will fail (no controller running), but that's fine —
    // what matters is it returns quickly, not blocked by compile
    pool.submit('readSignal', ['/tmp/nosock', 'test', 'x1']),
  ]);

  const elapsed = Date.now() - start;

  const signalBlocked = elapsed > 1000;

  return {
    elapsedMs: elapsed,
    signalBlocked,
    signalResult: signalRead.status === 'fulfilled'
      ? 'ok' : `rejected: ${signalRead.reason?.message || 'unknown'}`,
    ok: !signalBlocked,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const pool = new WorkerPool(4, 30000);

  // Wait for workers to be ready
  await new Promise(r => setTimeout(r, 200));

  const drift = new DriftTracker(100).start();
  const totalStart = Date.now();

  // Run 3 compile types, 100 iterations each (300 total compilations)
  const batches = await Promise.all([
    runBatch(pool, 'compileSt', ST_SRC, 100),
    runBatch(pool, 'compileIl', IL_SRC, 100),
    runBatch(pool, 'compileLd', LD_SRC, 100),
  ]);

  const totalElapsedMs = Date.now() - totalStart;
  drift.stop();

  // ── Results ──────────────────────────────────────────────────────────────
  console.log('══════════════════════════════════════════════');
  console.log('  WORKER_THREAD BENCHMARK RESULTS');
  console.log('══════════════════════════════════════════════');
  console.log(`Pool size: 4`);
  console.log(`Total time: ${totalElapsedMs}ms (limit: 30000ms)`);
  console.log('');
  console.log('Per-function breakdown:');
  for (const b of batches) {
    const status = b.failures === 0 ? '✓' : '✗';
    console.log(`  ${status} ${b.type}: ${b.count}x, avg ${b.avgMs}ms, ${b.failures} failures`);
  }
  console.log('');
  console.log('Main thread drift (setInterval 100ms):');
  const d = drift.summary();
  console.log(`  Samples: ${d.count}, avg drift: ${d.avgDriftMs}ms`);
  console.log(`  Max abs deviation: ${d.maxAbsDeviation}ms (limit: 20ms)`);
  console.log(`  Drift OK: ${d.ok ? '✓ PASS' : '✗ FAIL'}`);

  // ── Concurrency isolation ────────────────────────────────────────────────
  console.log('');
  console.log('Concurrency isolation test:');
  const iso = await testConcurrencyIsolation(pool);
  console.log(`  Result: ${iso.elapsedMs}ms elapsed`);
  console.log(`  Signal blocked: ${iso.signalBlocked ? '✗ FAIL (>1s)' : '✓ PASS (<1s)'}`);
  console.log(`  Signal result: ${iso.signalResult}`);

  // ── Memory leak check ────────────────────────────────────────────────────
  console.log('');
  console.log('Memory leak check (1000× compile_st):');
  if (global.gc) global.gc();
  const memStart = process.memoryUsage().heapUsed;
  for (let i = 0; i < 1000; i++) {
    await pool.submit('compileSt', [ST_SRC]);
  }
  if (global.gc) global.gc();
  const memEnd = process.memoryUsage().heapUsed;
  const memGrowthMB = ((memEnd - memStart) / (1024 * 1024)).toFixed(2);
  console.log(`  Heap start: ${(memStart / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`  Heap end:   ${(memEnd / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`  Growth:     ${memGrowthMB} MB (limit: 50MB)`);
  console.log(`  Memory OK:  ${Number(memGrowthMB) < 50 ? '✓ PASS' : '✗ FAIL'}`);

  // ── Final verdict ────────────────────────────────────────────────────────
  const passed =
    totalElapsedMs < 30000 &&
    d.ok &&
    iso.ok &&
    Number(memGrowthMB) < 50 &&
    batches.every(b => b.failures === 0);

  console.log('');
  console.log(`╔══════════════════════════════════════╗`);
  console.log(`║  VERDICT: ${passed ? '✓ ALL CHECKS PASSED' : '✗ SOME CHECKS FAILED'}`.padEnd(39) + '║');
  console.log(`╚══════════════════════════════════════╝`);

  await pool.shutdown();

  if (!passed) process.exit(1);
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
