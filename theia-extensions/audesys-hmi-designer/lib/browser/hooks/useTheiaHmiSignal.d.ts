export interface HmiSignalResult {
    value: string | null;
    error: string | null;
    clearError: () => void;
}
/**
 * Theia-specific HMI signal hook.
 * Uses napi-rs bridge to read controller signals.
 * Falls back to SimulationHarness for Preview mode in development.
 *
 * ponytail: 500ms polling with setInterval, same as studio version.
 */
export declare function useTheiaHmiSignal(signalName?: string): HmiSignalResult;
//# sourceMappingURL=useTheiaHmiSignal.d.ts.map