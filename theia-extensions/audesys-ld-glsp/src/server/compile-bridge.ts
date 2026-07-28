/**
 * LD Compiler Bridge — executes Rust compilation in a worker thread.
 *
 * napi-rs sync calls block the Node.js event loop. Running compilation
 * in a worker_thread prevents blocking GLSP server operations.
 *
 * Usage: `const result = await compileLdAsync(graphJson);`
 */
import { Worker } from 'worker_threads';
import * as path from 'path';

const WORKER_PATH = path.join(__dirname, 'compile-worker.js');

export interface CompileResult {
    success: boolean;
    programJson: string;
    diagnostics: Array<{
        severity: 'error' | 'warning' | 'info';
        message: string;
        code: string;
    }>;
}

/** Compile LD graph JSON in a worker thread. Non-blocking. */
export function compileLdAsync(graphJson: string): Promise<CompileResult> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(WORKER_PATH, {
            workerData: { graphJson },
        });

        worker.on('message', (result: CompileResult) => {
            resolve(result);
            worker.terminate();
        });

        worker.on('error', (err) => {
            reject(err);
        });

        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Compile worker exited with code ${code}`));
            }
        });
    });
}
