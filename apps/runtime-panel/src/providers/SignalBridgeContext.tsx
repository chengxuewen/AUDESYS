import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ISignalProvider } from "./ISignalProvider";
import type { HmiLayout } from "../types/hmi";
import { layoutLoader as defaultLoader } from "./LocalFileLayoutLoader";

interface SignalBridgeState {
  provider: ISignalProvider;
  layout: HmiLayout | null;
  isLayoutReady: boolean;
  reloadLayout: () => Promise<void>;
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
  const loader = layoutLoader ?? defaultLoader;

  const loadAndSet = useCallback(async () => {
    try {
      const next = await loader.loadLayout();
      setLayout(next);
      setIsLayoutReady(true);
    } catch (err) {
      console.error("[SignalBridge] layout load failed", err);
    }
  }, [loader]);

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
    });
  }, [loader]);

  const reloadLayout = useCallback(async () => {
    await loadAndSet();
  }, [loadAndSet]);

  return (
    <SignalBridgeContext.Provider value={{ provider, layout, isLayoutReady, reloadLayout }}>
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
