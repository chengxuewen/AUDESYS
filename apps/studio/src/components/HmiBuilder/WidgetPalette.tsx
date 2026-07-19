import type { HmiWidgetType } from "../../types/hmi";

interface WidgetPaletteProps {
  onAddWidget: (type: HmiWidgetType, label: string) => void;
}

const WIDGET_PRESETS: { type: HmiWidgetType; icon: string; label: string; desc: string; w: number; h: number }[] = [
  { type: "gauge", icon: "\u{1F4CA}", label: "Gauge", desc: "Circular gauge with thresholds", w: 200, h: 200 },
  { type: "button", icon: "\u{1F518}", label: "Button", desc: "Toggle or momentary command", w: 120, h: 60 },
  { type: "text", icon: "\u{1F4DD}", label: "Text", desc: "Static or dynamic text label", w: 200, h: 40 },
  { type: "indicator", icon: "\u{1F4A1}", label: "Indicator", desc: "Boolean status indicator", w: 80, h: 80 },
  { type: "trend", icon: "\u{1F4C8}", label: "Trend", desc: "Time-series line chart", w: 400, h: 300 },
  { type: "tank", icon: "\u{1FAA3}", label: "Tank", desc: "Liquid fill level display", w: 120, h: 200 },
  { type: "display", icon: "\u{1F522}", label: "Display", desc: "Numeric readout with units", w: 200, h: 60 },
];

export default function WidgetPalette({ onAddWidget }: WidgetPaletteProps) {
  return (
    <div
      style={{
        width: 220,
        backgroundColor: "#141416",
        borderRight: "1px solid #2a2a30",
        overflowY: "auto",
        flexShrink: 0,
      }}
    >
      <div
        className="app-panel__header"
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #2a2a30",
          color: "#FFB800",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Widgets
      </div>

      {WIDGET_PRESETS.map((preset) => (
        <div
          key={preset.type}
          onClick={() => {
            const x = 100 + Math.random() * 200;
            const y = 100 + Math.random() * 200;
            onAddWidget(preset.type, preset.label);
          }}
          style={{
            padding: "8px 12px",
            cursor: "pointer",
            borderBottom: "1px solid #1e1e22",
            transition: "background 100ms ease-out",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#1e1e22")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>{preset.icon}</span>
            <div>
              <div style={{ fontSize: 13, color: "#e8e8ed", fontWeight: 500 }}>
                {preset.label}
              </div>
              <div style={{ fontSize: 11, color: "#a0a0b0" }}>{preset.desc}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
