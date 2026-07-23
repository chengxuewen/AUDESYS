import { WidgetErrorOverlay } from "./WidgetErrorOverlay";
import type { SharedWidgetProps } from "./types";

export function DisplayWidget({ config, width, height, isPreview, signalValue, error, onDismissError }: SharedWidgetProps) {
  const rawValue = signalValue != null ? String(signalValue) : null;
  const unit = (config.unit as string) ?? "";
  const displayValue = isPreview && rawValue !== null ? `${rawValue}${unit}` : "---";

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      <rect x={1} y={1} width={width - 2} height={height - 2} rx={4}
        fill="#0a0a0b" stroke="#2a2a30" strokeWidth={1}
      />
      <text x={width - 8} y={height / 2 + 5} textAnchor="end" dominantBaseline="middle"
        fontFamily="JetBrains Mono, monospace" fontSize={Math.min(height * 0.45, 24)} fill="#00D26A">
        {displayValue}
      </text>
      <text x={8} y={height / 2 + 5} textAnchor="start" dominantBaseline="middle"
        fontFamily="Geist Sans, sans-serif" fontSize={12} fill="#a0a0b0">
        {(config.label as string) ?? ""}
      </text>
      </svg>
      {isPreview && error && (
        <WidgetErrorOverlay error={error} onDismiss={onDismissError ?? (() => {})} />
      )}
    </div>
  );
}

