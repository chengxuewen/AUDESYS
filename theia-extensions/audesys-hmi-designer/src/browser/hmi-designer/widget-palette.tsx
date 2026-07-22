import React from "react";
import type { HmiWidgetType } from "../types/hmi";

interface WidgetPaletteProps {
  onAddWidget: (type: HmiWidgetType, label: string) => void;
}

const WIDGET_PRESETS: { type: HmiWidgetType; icon: string; label: string; desc: string }[] = [
  { type: "gauge", icon: "📊", label: "Gauge", desc: "Circular gauge with thresholds" },
  { type: "button", icon: "🔘", label: "Button", desc: "Toggle or momentary command" },
  { type: "text", icon: "📝", label: "Text", desc: "Static or dynamic text label" },
  { type: "indicator", icon: "💡", label: "Indicator", desc: "Boolean status indicator" },
  { type: "trend", icon: "📈", label: "Trend", desc: "Time-series line chart" },
  { type: "tank", icon: "🪣", label: "Tank", desc: "Liquid fill level display" },
  { type: "display", icon: "🔢", label: "Display", desc: "Numeric readout with units" },
];

export default function WidgetPalette({ onAddWidget }: WidgetPaletteProps) {
  return (
    <div style={{ width: 220, backgroundColor: "#141416", borderRight: "1px solid #2a2a30", overflowY: "auto", flexShrink: 0 }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #2a2a30", color: "#FFB800", fontSize: 13, fontWeight: 600 }}>
        Widgets
      </div>
      {WIDGET_PRESETS.map((preset) => (
        <div
          key={preset.type}
          onClick={() => onAddWidget(preset.type, preset.label)}
          style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #1e1e22", transition: "background 100ms ease-out" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#1e1e22")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>{preset.icon}</span>
            <div>
              <div style={{ fontSize: 13, color: "#e8e8ed", fontWeight: 500 }}>{preset.label}</div>
              <div style={{ fontSize: 11, color: "#a0a0b0" }}>{preset.desc}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
