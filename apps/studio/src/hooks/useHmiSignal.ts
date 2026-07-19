import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * React hook that polls a single HAL signal value via Tauri IPC.
 *
 * Requires the Controller to be connected via the Debug Panel (managed state).
 * Follows the same pattern as controller_read_signal:
 * - Uses setInterval at 500ms to invoke `controller_read_signal`
 * - Cleans up the interval on unmount or signal name change
 * - Returns null when signalName is undefined, unbound, or unavailable
 *
 * @param signalName - Dot-notation HAL signal name (e.g. "axis.0.pos")
 * @returns The current string value of the signal, or null
 */
export function useHmiSignal(signalName?: string): string | null {
  const [value, setValue] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setValue(null);
    if (!signalName) return;

    const tick = async () => {
      try {
        // ponytail: use state-based controller_read_signal (persistent connection)
        const result = await invoke("controller_read_signal", {
          signalName,
        });
        setValue(String(result ?? null));
      } catch (_e) {
        setValue(null);
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

  return value;
}
