/**
 * HmiDesignerTool — HMI visual layout designer.
 * Combines HmiCanvas, PropertyPanel, and useHmiLayout hook.
 * Uses react-rnd for drag/resize, 7 widget types, YAML persistence.
 */
import { useState, useCallback } from "react";
import { usePlatform } from "../platform/provider";
import HmiCanvas from "../components/HmiBuilder/HmiCanvas";
import PropertyPanel from "../components/HmiBuilder/PropertyPanel";
import { useHmiLayout } from "../hooks/useHmiLayout";
import { HmiWidgetType } from "../types/hmi";
import type { ToolProps, ToolDescriptor } from "./types";
import { type PanelError } from "./utils";

export default function HmiDesignerTool({ toolId, eventBus }: ToolProps) {
  // ponytail: narrow eventBus from unknown (ToolRegistry placeholder)
  const eb = eventBus as Record<string, (...args: unknown[]) => void>;
  const hmi = useHmiLayout();
  const { invoke, openFileDialog, saveFileDialog } = usePlatform();
  const [errors, setErrors] = useState<PanelError[]>([]);

  const handleHmiSave = useCallback(async () => {
    try {
      const yaml = hmi.exportYaml();
      const selected = await saveFileDialog({
        title: "Save HMI Layout",
        filters: [{ name: "YAML", extensions: ["yaml", "yml"] }],
      });
      if (selected) {
        await invoke("save_hmi_layout", { path: selected, yaml });
      }
    } catch (e) {
      const msg = String(e);
      if (!msg.includes("cancelled") && !msg.includes("canceled")) {
        setErrors([{ line: 1, col: 1, message: `Failed to save HMI: ${msg}`, severity: "error" }]);
      }
    }
  }, [hmi]);

  const handleHmiLoad = useCallback(async () => {
    try {
      const selected = await openFileDialog({
        title: "Load HMI Layout",
        filters: [{ name: "YAML", extensions: ["yaml", "yml"] }],
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        const yaml: string = await invoke("load_hmi_layout", { path: selected });
        hmi.importYaml(yaml);
        eb?.emit("hmi-loaded", { toolId, layout: hmi.layout });
      }
    } catch (e) {
      const msg = String(e);
      if (!msg.includes("cancelled") && !msg.includes("canceled")) {
        setErrors([{ line: 1, col: 1, message: `Failed to load HMI: ${msg}`, severity: "error" }]);
      }
    }
  }, [hmi, toolId, eventBus]);

  const handleHmiDeploy = useCallback(async () => {
    try {
      const result = hmi.validateBeforeSave();
      if (result.errors.length > 0) {
        setErrors(result.errors.map((e: string) => ({ line: 1, col: 1, message: e, severity: "error" as const })));
        return;
      }
      const yaml = hmi.exportYaml();
      const gen: string = await invoke("deploy_hmi_layout", {
        socketPath: "",
        secret: "",
        yamlBytes: Array.from(new TextEncoder().encode(yaml)),
      });
      setErrors([{ line: 1, col: 1, message: "\u2714 deployed", severity: "warning" as const }]);
      eb?.emit("hmi-deployed", { toolId, gen });
    } catch (e) {
      setErrors([{ line: 1, col: 1, message: `deploy failed: ${String(e)}`, severity: "error" }]);
    }
  }, [hmi, toolId, eventBus]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {errors.length > 0 && (
        <div style={{ background: "var(--color-surface-2)", borderBottom: "1px solid var(--color-border)", fontSize: 12, maxHeight: 80, overflow: "auto" }}>
          {errors.map((e, i) => (
            <div key={i} style={{ padding: "2px 12px", color: e.severity === "error" ? "var(--color-error)" : "var(--color-warning)" }}>
              {e.message}
              <button
                style={{ marginLeft: 8, background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 12 }}
                onClick={() => setErrors([])}
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <HmiCanvas
          widgets={hmi.layout.widgets}
          selectedWidgetId={hmi.selectedWidgetId}
          onSelectWidget={hmi.selectWidget}
          onUpdateWidget={hmi.updateWidget}
          onRemoveWidget={hmi.removeWidget}
          onAddWidget={(type: HmiWidgetType, label: string) => {
            hmi.addWidget(type, { x: 100 + hmi.layout.widgets.length * 20, y: 100 + hmi.layout.widgets.length * 20 }, { width: 200, height: 160 }, label);
          }}
          onSave={handleHmiSave}
          onLoad={handleHmiLoad}
          onDeploy={handleHmiDeploy}
        />
        <PropertyPanel
          widget={hmi.selectedWidget}
          onUpdateWidget={hmi.updateWidget}
          onRemoveWidget={hmi.removeWidget}
        />
      </div>
    </div>
  );
}

export const descriptor: ToolDescriptor = {
  id: "audesys.hmi-designer",
  label: "HMI Designer",
  icon: "layout",
  group: "editor",
  component: HmiDesignerTool,
};
