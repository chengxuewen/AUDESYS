import React, { useState, useCallback, useEffect } from "react";
import type { HmiWidgetState } from "../types/hmi";

interface SignalInjectorProps {
  widgets: HmiWidgetState[];
}

interface SignalEntry {
  widgetId: string;
  widgetLabel: string;
  signal: string;
  value: string;
}

function buildEntries(widgets: HmiWidgetState[]): Map<string, SignalEntry> {
  const m = new Map<string, SignalEntry>();
  for (const w of widgets) {
    if (w.signal) {
      m.set(w.id, { widgetId: w.id, widgetLabel: w.label, signal: w.signal, value: "" });
    }
  }
  return m;
}

export default function SignalInjector({ widgets }: SignalInjectorProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [entries, setEntries] = useState<Map<string, SignalEntry>>(() => buildEntries(widgets));
  const [feedback, setFeedback] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    setEntries(prev => {
      const next = buildEntries(widgets);
      for (const [id, existing] of prev) {
        const matched = next.get(id);
        if (matched && existing.value) matched.value = existing.value;
      }
      return next;
    });
  }, [widgets]);

  const handleSetValue = useCallback((widgetId: string, value: string) => {
    const e = entries.get(widgetId);
    if (!e) return;
    setEntries(prev => { const next = new Map(prev); next.set(widgetId, { ...e, value }); return next; });
  }, [entries]);

  const handleApply = useCallback(async (widgetId: string) => {
    const e = entries.get(widgetId);
    if (!e || e.value.trim() === "") return;
    try {
      const sim = (window as any).__audesysSim;
      if (sim?.setSignal) {
        const raw = e.value.trim();
        let valueStr: string;
        if (raw === "true" || raw === "false") valueStr = `Bool(${raw})`;
        else if (!Number.isNaN(Number(raw))) valueStr = `F64(${raw})`;
        else valueStr = raw;
        await sim.setSignal(e.signal, valueStr);
      }
      setFeedback(prev => { const next = new Map(prev); next.set(widgetId, "ok"); return next; });
    } catch (err) {
      setFeedback(prev => { const next = new Map(prev); next.set(widgetId, String(err)); return next; });
    }
  }, [entries]);

  const boundWidgets = widgets.filter(w => w.signal);

  return (
    <div style={{ width: collapsed ? 32 : 260, backgroundColor: "#141416", borderLeft: "1px solid #2a2a30", display: "flex", flexDirection: "column", flexShrink: 0, transition: "width 200ms ease-out", overflow: "hidden" }}>
      <div onClick={() => setCollapsed(c => !c)} style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", padding: collapsed ? "8px 0" : "8px 12px", backgroundColor: "#1e1e22", borderBottom: "1px solid #2a2a30", cursor: "pointer", flexShrink: 0 }}>
        {!collapsed && (
          <>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#e8e8ed", textTransform: "uppercase", letterSpacing: "0.5px" }}>Signal Inject</span>
            <span style={{ fontSize: 11, color: "#a0a0b0", fontFamily: "JetBrains Mono" }}>{boundWidgets.length}</span>
          </>
        )}
        <svg width={14} height={14} viewBox="0 0 14 14" fill="none" style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 200ms ease-out" }}>
          <path d="M4 6L7 9L10 6" stroke="#a0a0b0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {!collapsed && (
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {boundWidgets.length === 0 && (
            <div style={{ padding: "16px 12px", fontSize: 12, color: "#a0a0b0", textAlign: "center" }}>
              No signal-bound widgets.<br />Bind signals in Edit mode.
            </div>
          )}
          {boundWidgets.map(w => {
            const entry = entries.get(w.id);
            const fb = feedback.get(w.id);
            return (
              <div key={w.id} style={{ padding: "8px 12px", borderBottom: "1px solid #2a2a30" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#e8e8ed", marginBottom: 2 }}>{w.label}</div>
                <div style={{ fontSize: 10, fontFamily: "JetBrains Mono", color: "#a0a0b0", marginBottom: 6 }}>{w.signal}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <input type="text" value={entry?.value ?? ""}
                    onChange={e => handleSetValue(w.id, e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleApply(w.id); }}
                    placeholder="42"
                    spellCheck={false}
                    style={{ flex: 1, padding: "4px 8px", backgroundColor: "#0a0a0b", border: "1px solid #2a2a30", borderRadius: 4, color: "#e8e8ed", fontFamily: "JetBrains Mono", fontSize: 12, outline: "none", minWidth: 0 }}
                  />
                  <button onClick={() => handleApply(w.id)}
                    style={{ padding: "4px 10px", backgroundColor: "#FFB800", color: "#0a0a0b", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    Set
                  </button>
                </div>
                {fb && <div style={{ fontSize: 10, color: fb === "ok" ? "#00D26A" : "#FF4444", marginTop: 4 }}>{fb}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
