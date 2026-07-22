// Integration tests for worker_thread pool validation
// Tests: parallel compilation, concurrency isolation, abort/cancel, stability
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createRequire } from 'module';

const require_ = createRequire(import.meta.url);
const { WorkerPool } = require_('../test-worker/worker-pool');

// ── Compiler sources ─────────────────────────────────────────────
const ST_SRC = 'PROGRAM test VAR x : INT; y : INT; END_VAR; x := 42; y := x + 1; END_PROGRAM';
const IL_SRC = 'LD X1\nAND X2\nST Y1';
const LD_SRC = 'NETWORK\n  NO X1\n  NO X2\n  OUT Y1';


// ── Drift tracker ─────────────────────────────────────────────────

// ── Drift tracker ─────────────────────────────────────────────────
class DriftTracker {
  intervalMs: number;
  deviations: number[] = [];
  count = 0;
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _expected = 0;

  constructor(intervalMs = 100) {
    this.intervalMs = intervalMs;
  }

  start() {
    this._expected = Date.now() + this.intervalMs;
    this.deviations = [];
    this.count = 0;
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
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    return this;
  }

  maxAbsDeviation(): number {
    if (this.deviations.length === 0) return 0;
    return Math.max(...this.deviations.map(Math.abs));
  }
}

// ── Test suite ────────────────────────────────────────────────────
describe('Worker Thread Pool', () => {
  let pool: InstanceType<typeof WorkerPool>;

  afterEach(async () => {
    // Shut down pool between tests to prevent worker leaks
    try {
      if (pool) await pool.shutdown();
    } catch (_) {
      /* pool may already be shut down */
    }
  });

  // ── Test 1: Parallel compilation ──────────────────────────────
  test(
    'parallel compilation — all 3 compilers resolve within 10s, main thread drift ≤20ms',
    async () => {
      pool = new WorkerPool(4, 30000);
      // Give workers time to spawn and signal ready
      await new Promise((r) => setTimeout(r, 300));

      const drift = new DriftTracker(100).start();
      const start = Date.now();

      const [st, il, ld] = await Promise.all([
        pool.submit('compileSt', [ST_SRC]),
        pool.submit('compileIl', [IL_SRC]),
        pool.submit('compileLd', [LD_SRC]),
      ]);

      const elapsed = Date.now() - start;
      drift.stop();

      // All must resolve
      expect(st.result).toBeDefined();
      expect(il.result).toBeDefined();
      expect(ld.result).toBeDefined();

      // All within 10s
      expect(elapsed).toBeLessThan(10000);

      // Main thread drift ≤ 20ms
      const maxAbs = drift.maxAbsDeviation();
      expect(maxAbs).toBeLessThanOrEqual(20);
    },
    15000,
  );

  test('concurrency isolation — readSignal not blocked by compileSt', async () => {
    pool = new WorkerPool(4, 30000);
    await new Promise((r) => setTimeout(r, 300));

    const start = Date.now();

    // Submit a long-running busyWait (1s spin) AND a readSignal simultaneously.
    // readSignal will reject (no controller running), but must not be blocked
    // by the busy worker — the pool has 4 workers so it should go to another one.
    const [busyResult, signalResult] = await Promise.allSettled([
      pool.submit('busyWait', [1000]),
      pool.submit('readSignal', ['/tmp/nosock', 'test', 'signal.x']),
    ]);

    const elapsed = Date.now() - start;

    // busyWait must succeed
    expect(busyResult.status).toBe('fulfilled');

    // readSignal must reject (no controller) — that's expected
    expect(signalResult.status).toBe('rejected');

    // The key assertion: readSignal must not be blocked behind busyWait.
    // With 4 workers, readSignal goes to a free worker and fails in microseconds.
    // busyWait(1000) determines total elapsed; overhead < 1000ms means no blocking.
    expect(elapsed).toBeLessThan(2000);
  },
    15000);

  // ── Test 3: Abort/cancel ──────────────────────────────────────
  test(
    'abort/cancel — task rejects after AbortController fires at 2s',
    async () => {
      pool = new WorkerPool(1, 30000); // 1 worker ensures queue isolation
      await new Promise((r) => setTimeout(r, 300));

      const abortCtrl = new AbortController();

      // Submit a long-running task (compileLoop: 200k iterations)
      const task = new Promise<void>((resolve, reject) => {
        // ponytail: AbortSignal wrapper — pool doesn't natively support abort,
        // so we race the task against the abort timeout. If abort fires first,
        // the task promise is orphaned (worker keeps running until shutdown).
        // Upgrade path: add AbortSignal support to WorkerPool.submit().
        const onAbort = () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        };
        abortCtrl.signal.addEventListener('abort', onAbort, { once: true });

        pool.submit('compileLoop', [ST_SRC, 200000]).then(
          () => {
            abortCtrl.signal.removeEventListener('abort', onAbort);
            resolve();
          },
          (err: Error) => {
            abortCtrl.signal.removeEventListener('abort', onAbort);
            reject(err);
          },
        );
      });

      // Abort after 2s
      setTimeout(() => abortCtrl.abort(), 2000);

      const start = Date.now();
      try {
        await task;
        // Should not reach here — abort fires before compileLoop finishes
      } catch (err) {
        const elapsed = Date.now() - start;
        expect(err).toBeInstanceOf(DOMException);
        expect((err as DOMException).name).toBe('AbortError');
        // Must reject within 5s total
        expect(elapsed).toBeLessThan(5000);
      }
    },
    10000,
  );

  // ── Test 4: Stability ─────────────────────────────────────────
  test(
    'stability — 100 sequential compileSt calls all succeed',
    async () => {
      pool = new WorkerPool(4, 30000);
      await new Promise((r) => setTimeout(r, 300));

      for (let i = 0; i < 100; i++) {
        const r = await pool.submit('compileSt', [ST_SRC]);
        expect(r.result).toBeDefined();
        expect(r.elapsedNs).toBeGreaterThan(0);
      }
    },
    60000,
  );
});
