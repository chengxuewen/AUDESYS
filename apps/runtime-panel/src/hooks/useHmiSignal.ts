import { useEffect, useState } from "react";
import { mockSignals } from "../providers/MockSignalProvider";

// ponytail: read from MockSignalProvider, re-render on tick
export function useHmiSignal(signal?: string) {
  const [, forceRender] = useState(0);

  useEffect(() => {
    return mockSignals.onTick(() => forceRender((n) => n + 1));
  }, []);

  if (!signal) return { value: null, error: null, clearError: () => {} };

  const val = mockSignals.getValue(signal);
  return {
    value: val !== null ? val.toFixed(2) : null,
    error: null,
    clearError: () => {},
  };
}
