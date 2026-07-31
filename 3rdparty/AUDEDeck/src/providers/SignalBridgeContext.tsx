import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import type { ISignalProvider } from "./ISignalProvider";
import type { HmiLayout } from "../types/hmi";
import { layoutLoader as defaultLoader } from "./LocalFileLayoutLoader";

interface SignalBridgeState {
  provider: ISignalProvider;
  layout: HmiLayout | null;
  isLayoutReady: boolean;
  reloadLayout: () => Promise<void>;
  /** Current signal values keyed by signal name (e.g. "pump.0.speed" → "1200.5"). */
  signalValues: Record<string, string | null>;
}

interface LayoutLoaderApi {
  loadLayout: () => Promise<HmiLayout>;
  watchLayout: (onChange: (layout: HmiLayout) => void) => () => void;
}

const SignalBridgeContext = createContext<SignalBridgeState | null>(null);

interface SignalBridgeProviderProps {
  provider: ISignalProvider;
  layoutLoader?: LayoutLoaderApi;
  children: React.ReactNode;
}

export function SignalBridgeProvider({ provider, layoutLoader, children }: SignalBridgeProviderProps) {
  const [layout, setLayout] = useState<HmiLayout | null>(null);
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const [signalValues, setSignalValues] = useState<Record<string, string | null>>({});
  const unsubRef = useRef<(() => void) | null>(null);
  const loader = layoutLoader ?? defaultLoader;

  // Subscribe to all layout signals whenever layout changes
  const subscribeLayoutSignals = useCallback((nextLayout: HmiLayout) => {
    // Unsubscribe previous
    unsubRef.current?.();
    unsubRef.current = null;

    const signalNames = nextLayout.widgets
      .map((w) => w.signal)
      .filter((s): s is string => !!s);

    if (signalNames.length === 0) return;

    try {
      const unsub = provider.subscribeSignals(signalNames, (values) => {
        setSignalValues((prev) => ({ ...prev, ...values }));
      });
      unsubRef.current = unsub;
    } catch {
      /* provider may not support subscribe — fall through to poll */
    }
  }, [provider]);

  const loadAndSet = useCallback(async () => {
    try {
      const next = await loader.loadLayout();
      setLayout(next);
      subscribeLayoutSignals(next);
      setIsLayoutReady(true);
    } catch (err) {
      console.error("[SignalBridge] layout load failed", err);
    }
  }, [loader, subscribeLayoutSignals]);

  // Initial load + provider connect
  useEffect(() => {
    provider.connect().then(() => loadAndSet());
    return () => {
      provider.disconnect();
    };
  }, [provider, loadAndSet]);

  // Watch layout for changes (simulating Controller deploy)
  useEffect(() => {
    return loader.watchLayout((nextLayout) => {
      setLayout(nextLayout);
      subscribeLayoutSignals(nextLayout);
    });
  }, [loader, subscribeLayoutSignals]);

  const reloadLayout = useCallback(async () => {
    await loadAndSet();
  }, [loadAndSet]);

  // Cleanup unsubscribe on unmount
  useEffect(() => {
    return () => unsubRef.current?.();
  }, []);

  return (
    <SignalBridgeContext.Provider value={{ provider, layout, isLayoutReady, reloadLayout, signalValues }}>
      {children}
    </SignalBridgeContext.Provider>
  );
}

/** Access the SignalBridge context — throws if used outside provider. */
export function useSignalBridgeContext(): SignalBridgeState {
  const ctx = useContext(SignalBridgeContext);
  if (!ctx) {
    throw new Error("useSignalBridgeContext must be used within SignalBridgeProvider");
  }
  return ctx;
}

export default SignalBridgeContext;
