/**
 * LD Compile Worker — runs napi-rs compilation in a worker thread.
 *
 * This file is loaded by compile-bridge.ts via `new Worker()`.
 * It receives graphJson via workerData and posts back the result.
 */
import { parentPort, workerData } from 'worker_threads';

async function main(): Promise<void> {
    const { graphJson } = workerData as { graphJson: string };

    try {
        // napi-rs sync call — safe here because we're in a worker thread
        const bridge = require('@audesys/theia-bridge');
        const result = bridge.compileLd(graphJson);
        parentPort?.postMessage({
            success: result.success,
            programJson: result.programJson ?? '',
            diagnostics: result.diagnostics ?? [],
        });
    } catch (err) {
        parentPort?.postMessage({
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
