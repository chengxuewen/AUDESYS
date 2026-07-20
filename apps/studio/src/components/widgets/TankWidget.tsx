import { useHmiSignal } from "../../hooks/useHmiSignal";
import WidgetErrorOverlay from "./WidgetErrorOverlay";
interface TankWidgetProps {
  id: string; label: string; signal?: string;
  config: Record<string, unknown>;
  width: number; height: number;
  isSelected: boolean; isPreview: boolean;
}

export default function TankWidget({ signal, config, width, height, isPreview }: TankWidgetProps) {
  const { value: rawValue, error, clearError } = useHmiSignal(isPreview ? signal : undefined);
  const value = rawValue ? parseFloat(rawValue) : 0;
  const min = (config.min as number) ?? 0;
  const max = (config.max as number) ?? 100;
  const unit = (config.unit as string) ?? "%";

  const range = max - min;
  const ratio = Math.max(0, Math.min(1, (value - min) / range));

  const margin = 4;
  const tankW = width * 0.5;
  const tankH = height - margin * 2;
  const tankX = (width - tankW) / 2;
  const fillH = tankH * ratio;
  const fillY = margin + tankH - fillH;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      {/* Tank outline */}
      <rect x={tankX} y={margin} width={tankW} height={tankH}
        fill="#0a0a0b" stroke="#2a2a30" strokeWidth={1.5} rx={4}
      />
      {/* Fill level */}
      <rect x={tankX + 1.5} y={fillY} width={tankW - 3} height={fillH}
        fill="#0099FF" rx={3} style={{ transition: "height 500ms ease-out" }}
      />
      {/* Value text */}
      <text x={width / 2} y={margin + tankH - 8} textAnchor="middle"
        fontFamily="JetBrains Mono, monospace" fontSize={Math.min(tankW * 0.3, 16)} fill="#e8e8ed">
        {value.toFixed(1)}{unit}
      </text>
      {/* Label */}
      <text x={width / 2} y={height - 2} textAnchor="middle"
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
