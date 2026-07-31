import { useCallback } from "react";
import { useSignalBridgeContext } from "../providers/SignalBridgeContext";

/**
 * HMI signal hook — reads signal values from the SignalBridge context.
 * P1: values come from IpcSignalProvider (polling) or MockSignalAdapter.
 * P2: push-mode via SIGNAL_PUSH frames.
 */
export function useHmiSignal(signal?: string) {
  const { signalValues } = useSignalBridgeContext();

  const clearError = useCallback(() => {
    /* ponytail: error state management is per-widget; add when WidgetErrorOverlay needs it */
  }, []);

  if (!signal) {
    return { value: null, error: null, clearError };
  }

  const rawValue = signalValues[signal];
  // ponyail: try to format numeric values to 2 decimal places
  let parsed: number | null = null;
  if (rawValue !== null && rawValue !== undefined) {
    const num = Number(rawValue);
    if (!isNaN(num)) parsed = num;
  }

  return {
    value: parsed !== null ? parsed.toFixed(2) : rawValue ?? null,
    error: null,
    clearError,
  };
}
