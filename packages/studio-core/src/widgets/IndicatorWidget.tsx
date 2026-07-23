import { WidgetErrorOverlay } from "./WidgetErrorOverlay";
import type { SharedWidgetProps } from "./types";

export function IndicatorWidget({ signal: signalName, config, width, height, isPreview, signalValue, error, onDismissError }: SharedWidgetProps & { signal?: string }) {
  const rawValue = signalValue != null ? String(signalValue) : null;
  const isOn = rawValue !== null && rawValue !== "0" && rawValue !== "false";
  const onColor = (config.onColor as string) ?? "#00D26A";
  const offColor = (config.offColor as string) ?? "#FF4444";
  const color = isOn ? onColor : offColor;

  const cx = width / 2;
  const cy = height * 0.4;
  const r = Math.min(width, height) * 0.25;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      {/* Glow filter */}
      <defs>
        <filter id={`glow-${signalName ?? "ind"}`}>
          <feGaussianBlur stdDeviation={isOn ? 4 : 1} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx={cx} cy={cy} r={r}
        fill={color} filter={`url(#glow-${signalName ?? "ind"})`}
        style={{ transition: "fill 150ms ease-out" }}
      />
      {/* Label below */}
      <text x={cx} y={cy + r + 16} textAnchor="middle"
        fontFamily="Geist Sans, sans-serif" fontSize={11} fill="#a0a0b0">
        {(config.label as string) ?? ""}
      </text>
      </svg>
      {isPreview && error && (
        <WidgetErrorOverlay error={error} onDismiss={onDismissError ?? (() => {})} />
      )}
    </div>
  );
}

