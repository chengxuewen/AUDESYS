import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { HmiWidgetState } from "../../types/hmi";

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

  // Sync entries when widgets change (add/remove signal-bound widgets)
  useEffect(() => {
    setEntries(prev => {
      const next = buildEntries(widgets);
      // Preserve existing values for widgets that remain
      for (const [id, existing] of prev) {
        const matched = next.get(id);
        if (matched && existing.value) {
          matched.value = existing.value;
        }
      }
      return next;
    });
    // ponytail: intentionally omit prev in deps — we only read prev via setEntries callback
  }, [widgets]);

  const handleSetValue = useCallback((widgetId: string, value: string) => {
    const e = entries.get(widgetId);
    if (!e) return;

    setEntries(prev => {
      const next = new Map(prev);
      next.set(widgetId, { ...e, value });
      return next;
    });
  }, [entries]);

  const handleApply = useCallback(async (widgetId: string) => {
    const e = entries.get(widgetId);
    if (!e || e.value.trim() === "") return;

    try {
      // Format heuristic: try F64 first, then Bool, then raw string
      const raw = e.value.trim();
      let valueStr: string;
      if (raw === "true" || raw === "false") {
        valueStr = `Bool(${raw})`;
      } else if (!Number.isNaN(Number(raw))) {
        valueStr = `F64(${raw})`;
      } else {
        valueStr = raw;
      }

      await invoke("sim_set_signal", { name: e.signal, value: valueStr });
      setFeedback(prev => {
        const next = new Map(prev);
        next.set(widgetId, "ok");
        return next;
      });
    } catch (err) {
      setFeedback(prev => {
        const next = new Map(prev);
        next.set(widgetId, String(err));
        return next;
      });
    }
  }, [entries]);

  const boundWidgets = widgets.filter(w => w.signal);

  return (
    <div style={{
      width: collapsed ? 32 : 260,
      backgroundColor: "var(--color-surface-2)",
      borderLeft: "1px solid var(--color-border)",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      transition: "width 200ms ease-out",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          padding: collapsed ? "8px 0" : "8px 12px",
          backgroundColor: "var(--color-surface-3)",
          borderBottom: "1px solid var(--color-border)",
          cursor: "pointer",
          flexShrink: 0,
          gap: 8,
        }}
      >
        {!collapsed && (
          <>
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-text-primary)",
              whiteSpace: "nowrap",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>
              Signal Inject
            </span>
            <span style={{
              fontSize: 11,
              color: "var(--color-text-tertiary)",
              fontFamily: "var(--font-mono)",
            }}>
              {boundWidgets.length}
            </span>
          </>
        )}
        <svg width={14} height={14} viewBox="0 0 14 14" fill="none"
          style={{
            transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
            transition: "transform 200ms ease-out",
          }}>
          <path d="M4 6L7 9L10 6" stroke="var(--color-text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {!collapsed && (
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 0",
        }}>
          {boundWidgets.length === 0 && (
            <div style={{
              padding: "16px 12px",
              fontSize: 12,
              color: "var(--color-text-tertiary)",
              textAlign: "center",
            }}>
              No signal-bound widgets.
              <br />
              Bind signals in Edit mode.
            </div>
          )}
          {boundWidgets.map(w => {
            const entry = entries.get(w.id);
            const fb = feedback.get(w.id);
            return (
              <div key={w.id} style={{
                padding: "8px 12px",
                borderBottom: "1px solid var(--color-border)",
              }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  marginBottom: 2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {w.label}
                </div>
                <div style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-text-tertiary)",
                  marginBottom: 6,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {w.signal}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <input
                    type="text"
                    value={entry?.value ?? ""}
                    onChange={e => handleSetValue(w.id, e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleApply(w.id); }}
                    placeholder="42"
                    style={{
                      flex: 1,
                      padding: "4px 8px",
                      backgroundColor: "var(--color-surface-1)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--color-text-primary)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      outline: "none",
                      minWidth: 0,
                    }}
                    spellCheck={false}
                  />
                  <button
                    onClick={() => handleApply(w.id)}
                    style={{
                      padding: "4px 10px",
                      backgroundColor: "var(--color-amber)",
                      color: "var(--color-canvas)",
                      border: "none",
                      borderRadius: "var(--radius-sm)",
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: "var(--font-body)",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    Apply
                  </button>
                </div>
                {fb && (
                  <div style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    color: fb === "ok" ? "var(--color-operational)" : "var(--color-error)",
                    marginTop: 4,
                  }}>
                    {fb === "ok" ? "✓ injected" : fb}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
