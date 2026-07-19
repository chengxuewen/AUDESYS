import { useState } from "react";
import { useHmiSignal } from "../../hooks/useHmiSignal";

interface ButtonWidgetProps {
  id: string; label: string; signal?: string;
  config: Record<string, unknown>;
  width: number; height: number;
  isSelected: boolean; isPreview: boolean;
}

export default function ButtonWidget({ label, signal, config, width, height, isSelected, isPreview }: ButtonWidgetProps) {
  const rawValue = useHmiSignal(isPreview ? signal : undefined);
  const isOn = rawValue !== null && rawValue !== "0" && rawValue !== "false";
  const [pressed, setPressed] = useState(false);

  const onColor = (config.onColor as string) ?? "#00D26A";
  const offColor = (config.offColor as string) ?? "#2a2a30";
  const bgColor = (isPreview ? isOn : pressed) ? onColor : offColor;

  const r = Math.min(width, height) * 0.15;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      <rect x={2} y={2} width={width - 4} height={height - 4} rx={r} ry={r}
        fill={bgColor} stroke={isSelected ? "#FFB800" : "#2a2a30"} strokeWidth={1}
        style={{ cursor: isPreview ? "pointer" : "default", transition: "fill 150ms ease-out" }}
        onMouseDown={isPreview ? () => setPressed(true) : undefined}
        onMouseUp={isPreview ? () => setPressed(false) : undefined}
        onMouseLeave={isPreview ? () => setPressed(false) : undefined}
      />
      <text x={width / 2} y={height / 2 + 5} textAnchor="middle" dominantBaseline="middle"
        fontFamily="Geist Sans, sans-serif" fontSize={Math.min(height * 0.35, 16)} fill="#e8e8ed"
        style={{ pointerEvents: "none", userSelect: "none" }}>
        {label}
      </text>
    </svg>
  );
}
