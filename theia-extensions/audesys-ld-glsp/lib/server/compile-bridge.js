"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileLdAsync = compileLdAsync;
/**
 * LD Compiler Bridge — executes Rust compilation in a worker thread.
 *
 * napi-rs sync calls block the Node.js event loop. Running compilation
 * in a worker_thread prevents blocking GLSP server operations.
 *
 * Usage: `const result = await compileLdAsync(graphJson);`
 */
const worker_threads_1 = require("worker_threads");
const path = __importStar(require("path"));
const WORKER_PATH = path.join(__dirname, 'compile-worker.js');
/** Compile LD graph JSON in a worker thread. Non-blocking. */
function compileLdAsync(graphJson) {
    return new Promise((resolve, reject) => {
        const worker = new worker_threads_1.Worker(WORKER_PATH, {
            workerData: { graphJson },
        });
        worker.on('message', (result) => {
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
//# sourceMappingURL=compile-bridge.js.map