import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * React hook that polls a single HAL signal value via Tauri IPC.
 *
 * Follows the same polling pattern as SignalWatchPanel:
 * - Uses setInterval at 500ms to invoke `read_controller_signal`
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
    // Clear any previous value when signal name changes
    setValue(null);

    if (!signalName) {
      return;
    }

    const tick = async () => {
      try {
        // ponytail: read_controller_signal returns unknown — cast to string
        const result = await invoke("read_controller_signal", {
          signalName,
        });
        setValue(String(result ?? null));
      } catch (_e) {
        // Signal unavailable or controller not responding — gracefully show null
        setValue(null);
      }
    };

    // Initial fetch
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
