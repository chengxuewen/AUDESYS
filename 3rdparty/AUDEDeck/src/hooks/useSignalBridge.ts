import { useEffect, useState, useRef } from "react";
import { useSignalBridgeContext } from "../providers/SignalBridgeContext";

/**
 * useSignalBridge — subscribe to one or more signal values via ISignalProvider.
 * Returns current signal values. Cleans up subscription on unmount or name change.
 *
 * Example:
 *   const signals = useSignalBridge(["axis.0.pos", "tank.level"]);
 *   // signals = { "axis.0.pos": "45.20", "tank.level": "75.00" }
 */
export function useSignalBridge(signalNames: string[]): Record<string, string | null> {
  const { provider, isLayoutReady } = useSignalBridgeContext();
  const [values, setValues] = useState<Record<string, string | null>>({});
  const nameKeyRef = useRef<string>("");

  useEffect(() => {
    if (!isLayoutReady || signalNames.length === 0) return;

    // ponytail: detect name list changes by serializing to a key
    const nameKey = signalNames.sort().join(",");
    if (nameKey !== nameKeyRef.current) {
      nameKeyRef.current = nameKey;
      // Reset values when subscription list changes
      setValues({});
    }

    // Subscribe via provider
    const unsub = provider.subscribeSignals(signalNames, (snapshot) => {
      setValues((prev) => ({ ...prev, ...snapshot }));
    });

    return unsub;
  }, [provider, signalNames, isLayoutReady]);

  return values;
}
