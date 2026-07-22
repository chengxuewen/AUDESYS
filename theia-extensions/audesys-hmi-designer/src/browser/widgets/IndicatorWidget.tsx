import React from "react";
import { useStudioHmiSignal as useHmiSignal } from "../hooks/useStudioHmiSignal";
import WidgetErrorOverlay from "./WidgetErrorOverlay";
interface IndicatorWidgetProps {
  id: string; label: string; signal?: string;
  config: Record<string, unknown>;
  width: number; height: number;
  isSelected: boolean; isPreview: boolean;
}

export default function IndicatorWidget({ signal, config, width, height, isPreview }: IndicatorWidgetProps) {
  const { value, error, clearError } = useHmiSignal(isPreview ? signal : undefined);
  const isOn = value !== null && value !== "0" && value !== "false";
  const onColor = (config.onColor as string) ?? "#00D26A";
  const offColor = (config.offColor as string) ?? "#FF4444";
  const color = isOn ? onColor : offColor;

  const cx = width / 2;
  const cy = height * 0.4;
  const r = Math.min(width, height) * 0.25;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <filter id={`glow-${signal ?? "ind"}`}>
          <feGaussianBlur stdDeviation={isOn ? 4 : 1} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx={cx} cy={cy} r={r}
        fill={color} filter={`url(#glow-${signal ?? "ind"})`}
        style={{ transition: "fill 150ms ease-out" }}
      />
      <text x={cx} y={cy + r + 16} textAnchor="middle"
        fontFamily="Geist Sans, sans-serif" fontSize={11} fill="#a0a0b0">
        {(config.label as string) ?? ""}
      </text>
      </svg>
      {isPreview && error && (
        <WidgetErrorOverlay message={error} onDismiss={clearError} />
      )}
    </div>
  );
}
