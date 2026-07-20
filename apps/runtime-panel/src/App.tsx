import { useMemo } from "react";
import PanelRenderer from "./components/PanelRenderer";
import { IpcSignalProvider } from "./providers/IpcSignalProvider";
import { MockSignalAdapter } from "./providers/MockSignalAdapter";
import { ipcLayoutLoader } from "./providers/IpcLayoutLoader";
import { layoutLoader as localLoader } from "./providers/LocalFileLayoutLoader";
import { SignalBridgeProvider, useSignalBridgeContext } from "./providers/SignalBridgeContext";
import type { ISignalProvider } from "./providers/ISignalProvider";

/** Inner component — accesses context after provider wraps the tree. */
function AppInner() {
  const { layout, isLayoutReady } = useSignalBridgeContext();

  if (!isLayoutReady || !layout) {
    return (
      <div style={{ padding: 24, color: "#a0a0b0", fontFamily: "sans-serif" }}>
        加载布局中…
      </div>
    );
  }

  return <PanelRenderer layout={layout} />;
}

function App() {
  const provider: ISignalProvider = useMemo(() => {
    // Try IPC; if Tauri not available (web mode), fall back to mock.
    try {
      if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
        return new IpcSignalProvider();
      }
    } catch {
      /* not in Tauri context */
    }
    return new MockSignalAdapter();
  }, []);

  return (
    <SignalBridgeProvider provider={provider} layoutLoader={ipcLayoutLoader}>
      <AppInner />
    </SignalBridgeProvider>
  );
}

export default App;
