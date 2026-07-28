"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * LD Compile Worker — runs napi-rs compilation in a worker thread.
 *
 * This file is loaded by compile-bridge.ts via `new Worker()`.
 * It receives graphJson via workerData and posts back the result.
 */
const worker_threads_1 = require("worker_threads");
async function main() {
    const { graphJson } = worker_threads_1.workerData;
    try {
        // napi-rs sync call — safe here because we're in a worker thread
        const bridge = require('@audesys/theia-bridge');
        const result = bridge.compileLd(graphJson);
        worker_threads_1.parentPort?.postMessage({
            success: result.success,
            programJson: result.programJson ?? '',
            diagnostics: result.diagnostics ?? [],
        });
    }
    catch (err) {
        worker_threads_1.parentPort?.postMessage({
            success: false,
            programJson: '',
            diagnostics: [{
                    severity: 'error',
                    message: err instanceof Error ? err.message : String(err),
                    code: 'COMPILE_ERROR',
                }],
        });
    }
}
main();
//# sourceMappingURL=compile-worker.js.map