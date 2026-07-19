import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface SignalBindingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (signalName: string) => void;
}

export default function SignalBindingDialog({ isOpen, onClose, onSelect }: SignalBindingDialogProps) {
  const [signals, setSignals] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    invoke<[string, string][]>("controller_signal_snapshot", {
      pattern: "*"
    }).then(snapshot => {
      setSignals(snapshot.map(([name]) => name));
    }).catch(() => {
      setSignals([]);
    });
  }, [isOpen]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  const filtered = signals.filter(s => s.toLowerCase().includes(search.toLowerCase()));

  if (!isOpen) return null;

  return (
    <div
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 360, maxHeight: 480, backgroundColor: "#1e1e22",
          border: "1px solid #2a2a30", borderRadius: 8,
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #2a2a30", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#FFB800", fontSize: 14, fontWeight: 600 }}>Bind Signal</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#a0a0b0", cursor: "pointer", fontSize: 18 }}>&times;</button>
        </div>

        {/* Search */}
        <div style={{ padding: "8px 16px" }}>
          <input
            type="text"
            placeholder="Search signals..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
            style={{
              width: "100%", padding: "6px 10px", backgroundColor: "#0a0a0b",
              border: "1px solid #2a2a30", borderRadius: 4, color: "#e8e8ed",
              fontSize: 12, fontFamily: "JetBrains Mono", outline: "none",
            }}
          />
        </div>

        {/* Signal list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
          {filtered.length === 0 && (
            <div style={{ padding: 16, color: "#a0a0b0", fontSize: 12, textAlign: "center" }}>
              {signals.length === 0 ? "No signals available (controller not connected?)" : "No matching signals"}
            </div>
          )}
          {filtered.map(name => (
            <div
              key={name}
              onClick={() => onSelect(name)}
              style={{
                padding: "6px 8px", cursor: "pointer", borderRadius: 4,
                fontFamily: "JetBrains Mono", fontSize: 12, color: "#e8e8ed",
                transition: "background 100ms ease-out",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#141416"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              {name}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: "8px 16px", borderTop: "1px solid #2a2a30", textAlign: "right" }}>
          <button
            className="app-btn"
            onClick={() => onSelect("")}
            style={{ fontSize: 12, padding: "4px 12px", color: "#FF4444", marginRight: 8 }}
          >
            Unbind
          </button>
          <button className="app-btn" onClick={onClose} style={{ fontSize: 12, padding: "4px 12px" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
