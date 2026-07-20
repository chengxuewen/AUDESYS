import React, { useState, useCallback } from "react";
import { Rnd } from "react-rnd";
import type { HmiWidgetState, HmiWidgetType } from "../../types/hmi";
import WidgetPalette from "./WidgetPalette";
import HmiToolbar from "./HmiToolbar";
import SignalInjector from "./SignalInjector";

// Lazy-loaded widget components — rendered by type
import GaugeWidget from "../widgets/GaugeWidget";
import ButtonWidget from "../widgets/ButtonWidget";
import TextWidget from "../widgets/TextWidget";
import IndicatorWidget from "../widgets/IndicatorWidget";
import TrendWidget from "../widgets/TrendWidget";
import TankWidget from "../widgets/TankWidget";
import DisplayWidget from "../widgets/DisplayWidget";

interface HmiCanvasProps {
  widgets: HmiWidgetState[];
  selectedWidgetId: string | null;
  onSelectWidget: (id: string | null) => void;
  onUpdateWidget: (id: string, patch: Partial<HmiWidgetState>) => void;
  onRemoveWidget: (id: string) => void;
  onAddWidget: (type: HmiWidgetType, label: string) => void;
  onSave: () => void;
  onLoad: () => void;
  onDeploy?: () => void;
}

const WIDGET_COMPONENTS: Record<HmiWidgetType, React.FC<{ id: string; label: string; signal?: string; config: Record<string, unknown>; width: number; height: number; isSelected: boolean; isPreview: boolean }>> = {
  gauge: GaugeWidget,
  button: ButtonWidget,
  text: TextWidget,
  indicator: IndicatorWidget,
  trend: TrendWidget,
  tank: TankWidget,
  display: DisplayWidget,
};

export default function HmiCanvas({ widgets, selectedWidgetId, onSelectWidget, onUpdateWidget, onRemoveWidget, onAddWidget, onSave, onLoad, onDeploy }: HmiCanvasProps) {
  const [editMode, setEditMode] = useState(true);

  const handleSave = useCallback(() => {
    onSave();
  }, [onSave]);

  const handleLoad = useCallback(() => {
    onLoad();
  }, [onLoad]);

  const handleClear = useCallback(() => {
    widgets.forEach(w => onRemoveWidget(w.id));
  }, [widgets, onRemoveWidget]);

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

  const isPreview = !editMode;

  return (
    <div className="hmi-builder" onKeyDown={handleKeyDown} tabIndex={0} style={{ display: "flex", height: "100%", outline: "none" }}>
      <WidgetPalette onAddWidget={onAddWidget} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <HmiToolbar
          editMode={editMode}
          onToggleMode={() => setEditMode(m => !m)}
          onSave={handleSave}
          onLoad={handleLoad}
          onClear={handleClear}
          onDeploy={onDeploy}
        />

        <div
          className="hmi-canvas"
          onClick={handleCanvasClick}
          style={{
            flex: 1,
            backgroundColor: "#0a0a0b",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {widgets.map((widget) => {
            const Widget = WIDGET_COMPONENTS[widget.type];
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
                {Widget ? (
                  <Widget
                    id={widget.id}
                    label={widget.label}
                    signal={widget.signal}
                    config={widget.config}
                    width={widget.size.width}
                    height={widget.size.height}
                    isSelected={isSelected}
                    isPreview={isPreview}
                  />
                ) : (
                  <div style={{ padding: 8, fontSize: 12, color: "#a0a0b0" }}>
                    Unknown: {widget.type}
                  </div>
                )}
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
      </div>

      {isPreview && <SignalInjector widgets={widgets} />}
    </div>
  );
}
