/**
 * HmiDesignerTool — Orchestrates canvas + palette + property panel + toolbar.
 *
 * ponytail: wraps useHmiLayout hook + sub-components in a flex layout,
 * matching the original HmiDesignerTool but without Tauri/platform deps.
 */
import React, { useState, useCallback } from "react";
import { useHmiLayout } from "../hooks/useHmiLayout";
import type { HmiWidgetType } from "../types/hmi";

import WidgetPalette from "./widget-palette";
import PropertyPanel from "./property-panel";
import HmiToolbar from "./hmi-toolbar";
import SignalInjector from "./signal-injector";

/**
 * Renders the React content for the canvas area.
 * Imported from the separate component file to avoid re-creating on every render.
 */
import HmiCanvasInner from "./components/HmiCanvas";

interface HmiDesignerToolProps {
  /** Expose YAML save result callback */
  onSaveYaml?: (yaml: string) => void;
  /** Expose YAML load callback (= set layout) */
  onLoadYaml?: () => Promise<string | null>;
  /** Expose deploy callback */
  onDeploy?: (yaml: string) => Promise<void>;
}

export default function HmiDesignerTool({ onSaveYaml, onLoadYaml, onDeploy }: HmiDesignerToolProps) {
  const hmi = useHmiLayout();
  const [editMode, setEditMode] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  const handleSave = useCallback(async () => {
    try {
      const yaml = hmi.exportYaml();
      onSaveYaml?.(yaml);
      setErrors([]);
    } catch (e) {
      setErrors([`Save failed: ${String(e)}`]);
    }
  }, [hmi, onSaveYaml]);

  const handleLoad = useCallback(async () => {
    try {
      if (onLoadYaml) {
        const yaml = await onLoadYaml();
        if (yaml) hmi.importYaml(yaml);
      }
      setErrors([]);
    } catch (e) {
      setErrors([`Load failed: ${String(e)}`]);
    }
  }, [hmi, onLoadYaml]);

  const handleClear = useCallback(() => {
    hmi.layout.widgets.forEach(w => hmi.removeWidget(w.id));
  }, [hmi]);

  const handleDeploy = useCallback(async () => {
    try {
      const result = hmi.validateBeforeSave();
      if (result.errors.length > 0) {
        setErrors(result.errors);
        return;
      }
      const yaml = hmi.exportYaml();
      await onDeploy?.(yaml);
      setErrors(["✓ deployed"]);
    } catch (e) {
      setErrors([`Deploy failed: ${String(e)}`]);
    }
  }, [hmi, onDeploy]);

  const handleAddWidget = useCallback((type: HmiWidgetType, label: string) => {
    hmi.addWidget(type, { x: 100 + hmi.layout.widgets.length * 20, y: 100 + hmi.layout.widgets.length * 20 }, { width: 200, height: 160 }, label);
  }, [hmi]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "#0a0a0b" }}>
      {/* Error bar */}
      {errors.length > 0 && (
        <div style={{ background: "#141416", borderBottom: "1px solid #2a2a30", fontSize: 12, maxHeight: 80, overflow: "auto" }}>
          {errors.map((e, i) => (
            <div key={i} style={{ padding: "2px 12px", color: "#e8e8ed" }}>
              {e}
              <button style={{ marginLeft: 8, background: "none", border: "none", color: "#a0a0b0", cursor: "pointer", fontSize: 12 }} onClick={() => setErrors([])}>
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}
      {/* Toolbar */}
      <HmiToolbar
        editMode={editMode}
        onToggleMode={() => setEditMode(m => !m)}
        onSave={handleSave}
        onLoad={handleLoad}
        onClear={handleClear}
        onDeploy={onDeploy ? handleDeploy : undefined}
      />
      {/* Main content: palette + canvas + (property panel | signal injector) */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <WidgetPalette onAddWidget={handleAddWidget} />

        {/* Canvas area — position:relative div with react-rnd children */}
        <div
          className="hmiapp-canvas"
          data-hmi-canvas="true"
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            backgroundColor: "#0a0a0b",
            contain: "layout style",
            overscrollBehavior: editMode ? "contain" : "auto",
          }}
          tabIndex={0}
        >
          <HmiCanvasInner
            widgets={hmi.layout.widgets}
            selectedWidgetId={hmi.selectedWidgetId}
            editMode={editMode}
            onSelectWidget={hmi.selectWidget}
            onUpdateWidget={hmi.updateWidget}
            onRemoveWidget={hmi.removeWidget}
          />
        </div>

        {editMode ? (
          <PropertyPanel
            widget={hmi.selectedWidget}
            onUpdateWidget={hmi.updateWidget}
            onRemoveWidget={hmi.removeWidget}
          />
        ) : (
          <SignalInjector widgets={hmi.layout.widgets} />
        )}
      </div>
    </div>
  );
}
