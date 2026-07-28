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
export declare function compileLdAsync(graphJson: string): Promise<CompileResult>;
//# sourceMappingURL=compile-bridge.d.ts.map