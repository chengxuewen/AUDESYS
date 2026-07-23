import { WidgetErrorOverlay } from "./WidgetErrorOverlay";
import type { SharedWidgetProps } from "./types";

export function TextWidget({ label, config, width, height, isPreview, signalValue, error, onDismissError }: SharedWidgetProps) {
  const rawValue = signalValue != null ? String(signalValue) : null;
  const fontSize = (config.fontSize as number) ?? 14;
  const color = (config.color as string) ?? "#e8e8ed";
  const displayText = isPreview && rawValue !== null ? rawValue : label;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      <text x={width / 2} y={height / 2 + 4} textAnchor="middle" dominantBaseline="middle"
        fontFamily="Geist Sans, -apple-system, system-ui, sans-serif"
        fontSize={fontSize} fill={color} style={{ userSelect: "none" }}>
        {displayText}
      </text>
      </svg>
      {isPreview && error && (
        <WidgetErrorOverlay error={error} onDismiss={onDismissError ?? (() => {})} />
      )}
    </div>
  );
}

