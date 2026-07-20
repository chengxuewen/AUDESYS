import { useHmiSignal } from "../../hooks/useHmiSignal";
import WidgetErrorOverlay from "./WidgetErrorOverlay";
interface DisplayWidgetProps {
  id: string; label: string; signal?: string;
  config: Record<string, unknown>;
  width: number; height: number;
  isSelected: boolean; isPreview: boolean;
}

export default function DisplayWidget({ signal, config, width, height, isPreview }: DisplayWidgetProps) {
  const { value, error, clearError } = useHmiSignal(isPreview ? signal : undefined);
  const unit = (config.unit as string) ?? "";
  const displayValue = isPreview && value !== null ? `${value}${unit}` : "---";

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
        <WidgetErrorOverlay message={error} onDismiss={clearError} />
      )}
    </div>
  );
}
