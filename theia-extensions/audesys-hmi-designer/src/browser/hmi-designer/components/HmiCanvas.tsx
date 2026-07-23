/**
 * HmiCanvas — React component rendered inside the Lumino canvas widget.
 * Renders react-rnd draggable/resizable widgets on a position:relative canvas.
 *
 * ponytail: derived from apps/studio/src/components/HmiBuilder/HmiCanvas.tsx
 * but stripped of outer wrapper — WidgetPalette, toolbar, SignalInjector are
 * handled by HmiDesignerTool.
 */
import { useCallback } from "react";
import { Rnd } from "react-rnd";
import type { HmiWidgetState, HmiWidgetType } from "../../types/hmi";
import { useTheiaHmiSignal } from "../../hooks/useTheiaHmiSignal";

import { GaugeWidget } from "../../widgets/GaugeWidget";
import { ButtonWidget } from "../../widgets/ButtonWidget";
import { TextWidget } from "../../widgets/TextWidget";
import { IndicatorWidget } from "../../widgets/IndicatorWidget";
import { TrendWidget } from "../../widgets/TrendWidget";
import { TankWidget } from "../../widgets/TankWidget";
import { DisplayWidget } from "../../widgets/DisplayWidget";

type HmiCanvasProps = {
  widgets: HmiWidgetState[];
  selectedWidgetId: string | null;
  editMode: boolean;
  onSelectWidget: (id: string | null) => void;
  onUpdateWidget: (id: string, patch: Partial<HmiWidgetState>) => void;
  onRemoveWidget: (id: string) => void;
};

const WIDGET_COMPONENTS: Record<HmiWidgetType, React.FC<{
  id: string; label: string; signal?: string;
  config: Record<string, unknown>;
  width: number; height: number;
  isSelected: boolean; isPreview: boolean;
  signalValue?: number | boolean | string | null;
  error?: string | null;
  onDismissError?: () => void;
}>> = {
  gauge: GaugeWidget,
  button: ButtonWidget,
  text: TextWidget,
  indicator: IndicatorWidget,
  trend: TrendWidget,
  tank: TankWidget,
  display: DisplayWidget,
};

// Signal-injecting wrapper: uses theia hook, passes signalValue to pure-UI widget
function WidgetWithSignal({ widget, isSelected, isPreview }: {
  widget: HmiWidgetState;
  isSelected: boolean;
  isPreview: boolean;
}) {
  const { value, error, clearError } = useTheiaHmiSignal(widget.signal);
  const Widget = WIDGET_COMPONENTS[widget.type];
  if (!Widget) return null;
  return (
    <Widget
      id={widget.id}
      label={widget.label}
      signal={widget.signal}
      config={widget.config}
      width={widget.size.width}
      height={widget.size.height}
      isSelected={isSelected}
      isPreview={isPreview}
      signalValue={value}
      error={error}
      onDismissError={clearError}
    />
  );
}

export default function HmiCanvas({
  widgets, selectedWidgetId, editMode,
  onSelectWidget, onUpdateWidget, onRemoveWidget,
}: HmiCanvasProps) {
  const isPreview = !editMode;

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onSelectWidget(null);
    }
  }, [onSelectWidget]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === "Delete" || e.key === "Backspace") && selectedWidgetId) {
      onRemoveWidget(selectedWidgetId);
    }
  }, [selectedWidgetId, onRemoveWidget]);

  return (
    <div
      onClick={handleCanvasClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      data-hmi-canvas-inner="true"
      style={{
        width: "100%", height: "100%",
        position: "relative",
        overflow: "hidden",
        outline: "none",
      }}
    >
      {widgets.map((widget) => {
        const isSelected = selectedWidgetId === widget.id;
        return (
          <Rnd
            key={widget.id}
            position={{ x: widget.position.x, y: widget.position.y }}
            size={{ width: widget.size.width, height: widget.size.height }}
            minWidth={80}
            minHeight={40}
            bounds="parent"
            enableResizing={editMode}
            disableDragging={!editMode}
            onDragStop={(_e, d) =>
              onUpdateWidget(widget.id, { position: { x: d.x, y: d.y } })
            }
            onResizeStop={(_e, _dir, ref, _delta, pos) =>
              onUpdateWidget(widget.id, {
                size: { width: Math.round(ref.offsetWidth), height: Math.round(ref.offsetHeight) },
                position: { x: pos.x, y: pos.y },
              })
            }
            onClick={() => onSelectWidget(widget.id)}
            style={{
              border: isSelected ? "2px solid #FFB800" : "1px solid #2a2a30",
              borderRadius: "4px",
              overflow: "hidden",
              background: "transparent",
            }}
          >
            <WidgetWithSignal
              widget={widget}
              isSelected={isSelected}
              isPreview={isPreview}
            />
          </Rnd>
        );
      })}

      {widgets.length === 0 && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          color: "#a0a0b0", fontSize: 14,
        }}>
          Add widgets from the palette to start designing your HMI panel.
        </div>
      )}
    </div>
  );
}
