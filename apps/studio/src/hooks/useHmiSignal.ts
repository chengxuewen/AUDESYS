import { useState, useEffect, useRef } from "react";
import { usePlatform } from "../platform/provider";

/**
 * React hook that polls a single HAL signal value via Tauri IPC.
 *
 * Requires the Controller to be connected via the Debug Panel (managed state).
 * Follows the same pattern as controller_read_signal:
 * - Uses setInterval at 500ms to invoke `controller_read_signal`
 * - Cleans up the interval on unmount or signal name change
 * - Returns null value when signalName is undefined, unbound, or unavailable
 * - Returns error state when the IPC call fails (e.g. Controller disconnected)
 * - clearError() dismisses the error (click the error overlay to retry)
 *
 * @param signalName - Dot-notation HAL signal name (e.g. "axis.0.pos")
 * @returns Object with string value (or null), error message (or null), and clearError function
 */
export function useHmiSignal(signalName?: string): { value: string | null; error: string | null; clearError: () => void } {
  const { invoke } = usePlatform();
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setValue(null);
    setError(null);
    if (!signalName) return;

    const tick = async () => {
      try {
        // ponytail: use state-based controller_read_signal (persistent connection)
        const result = await invoke("controller_read_signal", {
          signalName,
        });
        setValue(String(result ?? null));
        setError(null);
      } catch (e) {
        // ponytail: set error state so widgets can show visual error indicator
        setValue(null);
        setError(String(e));
        console.error('[useHmiSignal]', signalName, e);
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
