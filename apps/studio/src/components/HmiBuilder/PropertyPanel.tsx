import { useState, useCallback } from "react";
import type { HmiWidgetState } from "../../types/hmi";
import SignalBindingDialog from "./SignalBindingDialog";

interface PropertyPanelProps {
  widget: HmiWidgetState | null;
  onUpdateWidget: (id: string, patch: Partial<HmiWidgetState>) => void;
  onRemoveWidget: (id: string) => void;
}

export default function PropertyPanel({ widget, onUpdateWidget, onRemoveWidget }: PropertyPanelProps) {
  const [showSignalDialog, setShowSignalDialog] = useState(false);

  const handleChange = useCallback((field: string, value: unknown) => {
    if (!widget) return;
    // Parse position/size fields
    if (["x", "y"].includes(field)) {
      onUpdateWidget(widget.id, { position: { ...widget.position, [field]: Number(value) } });
    } else if (["width", "height"].includes(field)) {
      onUpdateWidget(widget.id, { size: { ...widget.size, [field]: Number(value) } });
    } else if (field === "label") {
      onUpdateWidget(widget.id, { label: String(value) });
    } else {
      // Widget config field
      onUpdateWidget(widget.id, { config: { ...widget.config, [field]: value } });
    }
  }, [widget, onUpdateWidget]);

  const handleSignalSelect = useCallback((signalName: string) => {
    if (!widget) return;
    onUpdateWidget(widget.id, { signal: signalName });
    setShowSignalDialog(false);
  }, [widget, onUpdateWidget]);

  if (!widget) {
    return (
      <div style={{ width: 280, backgroundColor: "#141416", borderLeft: "1px solid #2a2a30", flexShrink: 0 }}>
        <div className="app-panel__header" style={{ padding: "8px 12px", borderBottom: "1px solid #2a2a30", color: "#FFB800", fontSize: 13, fontWeight: 600 }}>
          Properties
        </div>
        <div style={{ padding: 16, color: "#a0a0b0", fontSize: 12 }}>
          Select a widget to edit properties
        </div>
      </div>
    );
  }

  const configFields: Record<string, { label: string; type: string; key: string; defaultVal: unknown }[]> = {
    gauge: [
      { label: "Min", type: "number", key: "min", defaultVal: 0 },
      { label: "Max", type: "number", key: "max", defaultVal: 100 },
      { label: "Unit", type: "text", key: "unit", defaultVal: "" },
    ],
    button: [
      { label: "On Color", type: "color", key: "onColor", defaultVal: "#00D26A" },
      { label: "Off Color", type: "color", key: "offColor", defaultVal: "#2a2a30" },
    ],
    text: [
      { label: "Font Size", type: "number", key: "fontSize", defaultVal: 14 },
      { label: "Color", type: "color", key: "color", defaultVal: "#e8e8ed" },
    ],
    indicator: [
      { label: "On Color", type: "color", key: "onColor", defaultVal: "#00D26A" },
      { label: "Off Color", type: "color", key: "offColor", defaultVal: "#FF4444" },
    ],
    trend: [
      { label: "History", type: "number", key: "history", defaultVal: 60 },
      { label: "Color", type: "color", key: "color", defaultVal: "#FFB800" },
    ],
    tank: [
      { label: "Min", type: "number", key: "min", defaultVal: 0 },
      { label: "Max", type: "number", key: "max", defaultVal: 100 },
      { label: "Unit", type: "text", key: "unit", defaultVal: "%" },
    ],
    display: [
      { label: "Unit", type: "text", key: "unit", defaultVal: "" },
    ],
  };

  const fields = configFields[widget.type] ?? [];

  return (
    <div style={{ width: 280, backgroundColor: "#141416", borderLeft: "1px solid #2a2a30", flexShrink: 0, overflowY: "auto" }}>
      <div className="app-panel__header" style={{ padding: "8px 12px", borderBottom: "1px solid #2a2a30", color: "#FFB800", fontSize: 13, fontWeight: 600 }}>
        Properties
      </div>

      <div style={{ padding: "8px 12px" }}>
        {/* Position */}
        <SectionHeader label="Position & Size" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          <NumInput label="X" value={widget.position.x} onChange={v => handleChange("x", v)} />
          <NumInput label="Y" value={widget.position.y} onChange={v => handleChange("y", v)} />
          <NumInput label="W" value={widget.size.width} onChange={v => handleChange("width", v)} />
          <NumInput label="H" value={widget.size.height} onChange={v => handleChange("height", v)} />
        </div>

        {/* Label */}
        <SectionHeader label="Label" />
        <input
          type="text" value={widget.label}
          onChange={e => handleChange("label", e.target.value)}
          style={{ width: "100%", padding: "4px 6px", backgroundColor: "#1e1e22", border: "1px solid #2a2a30", borderRadius: 4, color: "#e8e8ed", fontSize: 12, fontFamily: "Geist Sans" }}
        />

        {/* Signal Binding */}
        <SectionHeader label="Signal" />
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#a0a0b0", flex: 1, fontFamily: "JetBrains Mono", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {widget.signal ?? "(none)"}
          </span>
          <button
            className="app-btn" style={{ fontSize: 11, padding: "2px 8px" }}
            onClick={() => setShowSignalDialog(true)}
          >
            Bind
          </button>
          {widget.signal && (
            <button
              className="app-btn" style={{ fontSize: 11, padding: "2px 8px", color: "#FF4444" }}
              onClick={() => onUpdateWidget(widget.id, { signal: undefined })}
            >
              ×
            </button>
          )}
        </div>

        {/* Type-specific config */}
        {fields.length > 0 && <SectionHeader label="Config" />}
        {fields.map(f => (
          <div key={f.key} style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 11, color: "#a0a0b0", display: "block", marginBottom: 2 }}>{f.label}</label>
            {f.type === "color" ? (
              <input type="color"
                value={String(widget.config[f.key] ?? f.defaultVal)}
                onChange={e => handleChange(f.key, e.target.value)}
                style={{ width: "100%", height: 24, backgroundColor: "#1e1e22", border: "1px solid #2a2a30", borderRadius: 4, cursor: "pointer" }}
              />
            ) : (
              <input type={f.type}
                value={String(widget.config[f.key] ?? f.defaultVal)}
                onChange={e => handleChange(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                style={{ width: "100%", padding: "2px 6px", backgroundColor: "#1e1e22", border: "1px solid #2a2a30", borderRadius: 4, color: "#e8e8ed", fontSize: 12 }}
              />
            )}
          </div>
        ))}

        {/* Delete */}
        <div style={{ marginTop: 12, paddingTop: 8, borderTop: "1px solid #2a2a30" }}>
          <button
            className="app-btn" style={{ width: "100%", fontSize: 12, padding: "4px 10px", color: "#FF4444", backgroundColor: "#1e1e22" }}
            onClick={() => {
              if (confirm("Remove this widget?")) onRemoveWidget(widget.id);
            }}
          >
            Remove Widget
          </button>
        </div>
      </div>

      {showSignalDialog && (
        <SignalBindingDialog
          isOpen={showSignalDialog}
          onClose={() => setShowSignalDialog(false)}
          onSelect={handleSignalSelect}
        />
      )}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return <div style={{ fontSize: 11, color: "#a0a0b0", marginTop: 8, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>;
}

function NumInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label style={{ fontSize: 10, color: "#a0a0b0", display: "block" }}>{label}</label>
      <input type="number" value={Math.round(value)}
        onChange={e => onChange(Number(e.target.value) || 0)}
        style={{ width: "100%", padding: "2px 4px", backgroundColor: "#1e1e22", border: "1px solid #2a2a30", borderRadius: 4, color: "#e8e8ed", fontSize: 11, fontFamily: "JetBrains Mono" }}
      />
    </div>
  );
}
