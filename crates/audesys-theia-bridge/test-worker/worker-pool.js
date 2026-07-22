// Worker Pool — manages a fixed-size pool of napi-rs worker threads
'use strict';

const { Worker } = require('worker_threads');
const path = require('path');

const WORKER_SCRIPT = path.join(__dirname, 'worker.js');

class WorkerPool {
  /**
   * @param {number} size  pool size (default 4)
   * @param {number} timeoutMs  per-task timeout (default 30000)
   */
  constructor(size = 4, timeoutMs = 30000) {
    this.size = size;
    this.timeoutMs = timeoutMs;
    this.workers = [];
    this.free = [];
    this.queue = [];
    this.nextId = 0;
    this.running = new Map();
    this._shuttingDown = false;

    for (let i = 0; i < size; i++) {
      this._spawn(i);
    }
  }

  _spawn(index) {
    const w = new Worker(WORKER_SCRIPT);
    this.workers[index] = { worker: w, busy: false };

    w.on('message', (msg) => {
      if (msg.ready) {
        this.free.push(index);
        this._drain();
        return;
      }
      const task = this.running.get(msg.id);
      if (!task) return;
      clearTimeout(task.timer);
      this.running.delete(msg.id);
      this.workers[index].busy = false;
      this.free.push(index);

      if (msg.error) {
        task.reject(new Error(msg.error));
      } else {
        task.resolve({ result: msg.result, elapsedNs: msg.elapsedNs });
      }
      this._drain();
    });

    w.on('error', (err) => {
      console.error(`Worker ${index} error:`, err.message);
      this._respawn(index);
    });

    w.on('exit', (code) => {
      if (code !== 0 && this.workers[index] && !this._shuttingDown) {
        console.error(`Worker ${index} exited with code ${code}`);
        this._respawn(index);
      }
    });
  }

  _respawn(index) {
    if (this._shuttingDown) return;
    for (const [id, task] of this.running) {
      if (this.workers[index] && this.workers[index].busy) {
        clearTimeout(task.timer);
        task.reject(new Error(`Worker ${index} terminated`));
        this.running.delete(id);
      }
    }
    this.workers[index] = null;
    this._spawn(index);
  }

  /**
   * Submit a task to the pool.
   * @param {string} type  function name
   * @param {Array}  args  function arguments
   * @returns {Promise<{result: string, elapsedNs: number}>}
   */
  submit(type, args) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const task = { type, id, args, resolve, reject };
      this.queue.push(task);
      this._drain();
    });
  }

  _drain() {
    while (this.free.length > 0 && this.queue.length > 0) {
      const index = this.free.shift();
      const task = this.queue.shift();
      const { id, type, args, resolve, reject } = task;

      this.workers[index].busy = true;
      const timer = setTimeout(() => {
        const t = this.running.get(id);
        if (t) {
          this.running.delete(id);
          t.reject(new Error(`Task ${type}#${id} timed out after ${this.timeoutMs}ms`));
          this.workers[index].worker.terminate();
          this._respawn(index);
        }
      }, this.timeoutMs);

      this.running.set(id, { resolve, reject, timer });
      this.workers[index].worker.postMessage({ type, id, args });
    }
  }

  /** Number of pending tasks in queue */
  get pending() {
    return this.queue.length;
  }

  /** Number of busy workers */
  get busy() {
    return this.size - this.free.length;
  }

  /** Graceful shutdown */
  async shutdown() {
    this._shuttingDown = true;

    // Reject all queued tasks
    while (this.queue.length > 0) {
      this.queue.shift().reject(new Error('Pool shut down'));
    }

    // Reject all running tasks
    for (const [id, task] of this.running) {
      clearTimeout(task.timer);
      task.reject(new Error('Pool shut down'));
      this.running.delete(id);
    }

    // Terminate all workers
    for (const { worker } of this.workers) {
      if (worker) await worker.terminate();
    }
  }
}

module.exports = { WorkerPool };
