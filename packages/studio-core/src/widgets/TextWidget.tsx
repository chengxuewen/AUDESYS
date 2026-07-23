import React from "react";
import { useStudioHmiSignal as useHmiSignal } from "../hooks/useStudioHmiSignal";
import WidgetErrorOverlay from "./WidgetErrorOverlay";
interface TextWidgetProps {
  id: string; label: string; signal?: string;
  config: Record<string, unknown>;
  width: number; height: number;
  isSelected: boolean; isPreview: boolean;
}

export default function TextWidget({ label, signal, config, width, height, isPreview }: TextWidgetProps) {
  const { value, error, clearError } = useHmiSignal(isPreview ? signal : undefined);
  const fontSize = (config.fontSize as number) ?? 14;
  const color = (config.color as string) ?? "#e8e8ed";
  const displayText = isPreview && value !== null ? value : label;

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
        <WidgetErrorOverlay message={error} onDismiss={clearError} />
      )}
    </div>
  );
}
