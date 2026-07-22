/**
 * SignalBrowserTool — real-time signal registry browser.
 * Combines SignalWatchPanel (live polling) with a signal table display.
 * Upgraded from the raw signal table in App.tsx.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { usePlatform } from "../platform/provider";
import type { ToolProps, ToolDescriptor } from "./types";

interface SignalEntry {
  name: string;
  value: string;
}

export default function SignalBrowserTool({ eventBus }: ToolProps) {
  // ponytail: narrow eventBus from unknown (ToolRegistry placeholder)
  const eb = eventBus as Record<string, (...args: unknown[]) => void>;
  const { invoke } = usePlatform();
  const [signals, setSignals] = useState<SignalEntry[]>([]);
  const [polling, setPolling] = useState(false);
  const [count, setCount] = useState(0);
  const [pattern, setPattern] = useState("*");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSignals = useCallback(async () => {
    try {
      const sigs: SignalEntry[] = await invoke("controller_signal_snapshot", { pattern });
      setSignals(sigs);
      setCount((c) => c + 1);
    } catch (_e) {
      // silently ignore — controller may not respond every tick
    }
  }, [pattern]);

  const startPolling = useCallback(() => {
    if (polling) return;
    setPolling(true);
    fetchSignals();
    intervalRef.current = setInterval(fetchSignals, 500);
  }, [polling, fetchSignals]);

  const stopPolling = useCallback(() => {
    setPolling(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Listen for external signal-change events
  useEffect(() => {
    const handler = (data: unknown) => {
      const d = data as { signals?: SignalEntry[] };
      if (d?.signals) setSignals(d.signals);
    };
    eb?.on("signal-change", handler);
    return () => { /* ponytail: no eventBus.off, simple enough */ };
  }, [eventBus]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="app-panel__header">
        Signal Browser
        <span style={{ fontSize: "11px", fontWeight: "normal", marginLeft: "8px" }}>
          {polling ? `\u25CF Live (${count})` : "\u25CB Idle"}
        </span>
      </div>
      <div style={{ padding: "4px 8px", display: "flex", gap: 4, alignItems: "center", background: "var(--color-surface-2)", borderBottom: "1px solid var(--color-border)" }}>
        <input
          type="text"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          style={{ flex: 1, fontSize: 12, padding: "2px 6px", backgroundColor: "var(--color-surface-3)", border: "1px solid var(--color-border)", borderRadius: 4, color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}
          placeholder="Signal pattern (e.g. axis.*)"
        />
        {!polling ? (
          <button onClick={startPolling} className="app-btn" style={{ fontSize: 12, padding: "4px 8px" }}>Start</button>
        ) : (
          <button onClick={stopPolling} className="app-btn" style={{ fontSize: 12, padding: "4px 8px" }}>Stop</button>
        )}
      </div>
      {signals.length > 0 ? (
        <div style={{ flex: 1, overflow: "auto" }}>
          <table className="app-signal-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th className="app-signal-table__th" style={{ textAlign: "left" }}>Signal Name</th>
                <th className="app-signal-table__th" style={{ textAlign: "right", width: "120px" }}>Value</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s) => (
                <tr key={s.name} className="app-signal-table__tr">
                  <td className="app-signal-table__td" style={{ fontSize: 12, padding: "4px 12px", fontFamily: "var(--font-mono)" }}>{s.name}</td>
                  <td className="app-signal-table__td app-signal-table__td--mono" style={{ fontSize: 12, padding: "4px 12px", textAlign: "right" }}>{s.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="app-panel__empty">
          {polling ? "Waiting for signals..." : "Connect to a controller and start polling to see signals."}
        </div>
      )}
    </div>
  );
}

export const descriptor: ToolDescriptor = {
  id: "audesys.signal-browser",
  label: "Signal Browser",
  icon: "signal",
  group: "monitor",
  component: SignalBrowserTool,
};
