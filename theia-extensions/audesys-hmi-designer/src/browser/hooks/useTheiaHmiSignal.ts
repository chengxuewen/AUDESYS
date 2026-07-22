import { useState, useEffect, useRef } from "react";

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
export function useTheiaHmiSignal(signalName?: string): HmiSignalResult {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setValue(null);
    setError(null);
    if (!signalName) return;

    const tick = async () => {
      try {
        // ponytail: try napi-rs bridge first, fallback to SimulationHarness
        const result = await readSignalNative(signalName);
        setValue(String(result ?? null));
        setError(null);
      } catch (e) {
        setValue(null);
        setError(String(e));
      }
    };

    tick();
    const id = setInterval(tick, 500);
    intervalRef.current = id;
    return () => {
      clearInterval(id);
      intervalRef.current = null;
    };
  }, [signalName]);

  const clearError = () => setError(null);
  return { value, error, clearError };
}

/**
 * Stub: reads a signal via napi-rs bridge or SimulationHarness.
 * Replace with actual napi-rs binding when theia-bridge crate is ready.
 */
async function readSignalNative(signalName: string): Promise<unknown> {
  // ponytail: try window.__audesysSim first (SimulationHarness stub for dev)
  const sim = (window as any).__audesysSim;
  if (sim?.readSignal) {
    return await sim.readSignal(signalName);
  }
  // ponytail: placeholder — real napi-rs bridge when implemented
  return null;
}
