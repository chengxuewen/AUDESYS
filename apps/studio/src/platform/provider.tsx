/**
 * PlatformAdapter React Context + Provider.
 *
 * Components use `usePlatform()` to get the adapter.
 * No component imports from @tauri-apps/* — only from here.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { IPlatformAdapter, PlatformMode } from "./types";
import { PcAdapter } from "./pc-adapter";
import { WebAdapter, type WebAdapterConfig } from "./web-adapter";

// ── Context ───────────────────────────────────────────────────────────

const PlatformContext = createContext<IPlatformAdapter | null>(null);

/** Hook — call inside any component to get the platform adapter. */
export function usePlatform(): IPlatformAdapter {
  const ctx = useContext(PlatformContext);
  if (!ctx) {
    throw new Error(
      "usePlatform() called outside <PlatformProvider> — wrap your app root",
    );
  }
  return ctx;
}

// ── Provider Props ────────────────────────────────────────────────────

interface PlatformProviderProps {
  mode: PlatformMode;
  /** Only required when mode === "web". */
  webConfig?: WebAdapterConfig;
  children: ReactNode;
}

// ── Provider ──────────────────────────────────────────────────────────

/**
 * Bootstraps the platform adapter and makes it available to the tree.
 *
 * Usage (PC mode, existing Tauri app):
 *   <PlatformProvider mode="pc">
 *     <App />
 *   </PlatformProvider>
 *
 * Usage (Web mode):
 *   <PlatformProvider mode="web" webConfig={{ backendUrl: "http://localhost:1420", wsUrl: "ws://localhost:1420/ws/dap" }}>
 *     <App />
 *   </PlatformProvider>
 */
export function PlatformProvider({
  mode,
  webConfig,
  children,
}: PlatformProviderProps): JSX.Element {
  const [adapter, setAdapter] = useState<IPlatformAdapter | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const a =
          mode === "pc"
            ? await PcAdapter.create()
            : await WebAdapter.create(webConfig!);
        if (!cancelled) setAdapter(a);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      }
    })();
    return () => { cancelled = true; };
  }, [mode, webConfig?.backendUrl, webConfig?.wsUrl]);

  if (error) {
    return (
      <div style={{ padding: "2rem", color: "red", fontFamily: "monospace" }}>
        <h2>Platform initialization failed</h2>
        <pre>{error.message}</pre>
      </div>
    );
  }

  if (!adapter) {
    return <div style={{ padding: "2rem" }}>Initializing platform…</div>;
  }

  return (
    <PlatformContext.Provider value={adapter}>
      {children}
    </PlatformContext.Provider>
  );
}
