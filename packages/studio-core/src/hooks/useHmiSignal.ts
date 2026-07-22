import { useState, useEffect, useRef } from "react";

/**
 * Return type for the useHmiSignal hook.
 */
export interface HmiSignalResult {
  /** String representation of the signal value, or null if unavailable. */
  value: string | null;
  /** Error message if the last read failed, or null. */
  error: string | null;
  /** Dismiss the current error and resume polling. */
  clearError: () => void;
}

/**
 * Generic polling hook for reading a single HAL signal.
 *
 * Accepts any async invoker function so the caller can supply
 * Tauri IPC, fetch()-based, or mock providers without changing
 * the polling and state logic.
 *
 * @param signalName - Dot-notation HAL signal name (e.g. "axis.0.pos").
 *                     undefined → polling is paused.
 * @param invoker     - (name: string) => Promise<unknown> — called each tick.
 * @param intervalMs  - Poll interval in milliseconds (default 500).
 */
export function useHmiSignal(
  signalName: string | undefined,
  invoker: (name: string) => Promise<unknown>,
  intervalMs = 500,
): HmiSignalResult {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setValue(null);
    setError(null);
    if (!signalName) return;

    const tick = async () => {
      try {
        const result = await invoker(signalName);
        setValue(String(result ?? null));
        setError(null);
      } catch (e) {
        setValue(null);
        setError(String(e));
      }
    };

    tick();
    const id = setInterval(tick, intervalMs);
    intervalRef.current = id;
    return () => {
      clearInterval(id);
      intervalRef.current = null;
    };
  }, [signalName, invoker, intervalMs]);

  const clearError = () => setError(null);

  return { value, error, clearError };
}
