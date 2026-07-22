import { useState, useCallback, useMemo } from "react";
import type { HmiLayout, HmiWidgetState, HmiWidgetType, HmiWidgetPosition, HmiWidgetSize } from "../types/hmi";
import { validateLayout } from "./useHmiLayoutValidator";
import type { ValidationResult } from "./useHmiLayoutValidator";

const DEFAULT_CANVAS = { width: 1200, height: 800 };

function createEmptyLayout(name: string): HmiLayout {
  return { version: 1, name, canvasWidth: DEFAULT_CANVAS.width, canvasHeight: DEFAULT_CANVAS.height, widgets: [] };
}

export function useHmiLayout(initialLayout?: HmiLayout) {
  const [layout, setLayout] = useState<HmiLayout>(initialLayout ?? createEmptyLayout("Untitled"));
  const clone = useCallback((l: HmiLayout): HmiLayout => JSON.parse(JSON.stringify(l)) as HmiLayout, []);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const selectedWidget = useMemo(() => {
    if (!selectedWidgetId) return null;
    return layout.widgets.find((w) => w.id === selectedWidgetId) ?? null;
  }, [layout.widgets, selectedWidgetId]);

  const selectWidget = useCallback((id: string | null) => { setSelectedWidgetId(id); }, []);
  const validateBeforeSave = useCallback((): ValidationResult => validateLayout(layout), [layout]);

  const exportYaml = useCallback((): string => {
    const lines: string[] = [];
    lines.push(`version: ${layout.version}`);
    lines.push(`name: ${layout.name}`);
    lines.push(`canvas_width: ${layout.canvasWidth}`);
    lines.push(`canvas_height: ${layout.canvasHeight}`);
    lines.push('widgets:');
    for (const w of layout.widgets) {
      lines.push(`  - id: ${w.id}`);
      lines.push(`    type: ${w.type}`);
      lines.push(`    position_x: ${w.position.x}`);
      lines.push(`    position_y: ${w.position.y}`);
      lines.push(`    size_width: ${w.size.width}`);
      lines.push(`    size_height: ${w.size.height}`);
      lines.push(`    label: ${w.label}`);
      if (w.signal) lines.push(`    signal: ${w.signal}`);
    }
    return lines.join('\n');
  }, [layout]);

  const importYaml = useCallback((yamlStr: string) => {
    try {
      const parsed = JSON.parse(yamlStr) as HmiLayout;
      setLayout(clone(parsed));
    } catch { /* skip */ }
  }, [clone]);

  const addWidget = useCallback((type: HmiWidgetType, position: HmiWidgetPosition, size: HmiWidgetSize, label: string): string => {
    const id = crypto.randomUUID();
    const widget: HmiWidgetState = { id, type, position, size, label, config: {} };
    setLayout((prev) => { const next = clone(prev); next.widgets.push(widget); return next; });
    return id;
  }, [clone]);

  const updateWidget = useCallback((id: string, patch: Partial<Omit<HmiWidgetState, "id">>): void => {
    setLayout((prev) => {
      const next = clone(prev);
      const idx = next.widgets.findIndex((w) => w.id === id);
      if (idx === -1) return prev;
      next.widgets[idx] = { ...next.widgets[idx], ...patch };
      return next;
    });
  }, [clone]);

  const removeWidget = useCallback((id: string): void => {
    setLayout((prev) => { const next = clone(prev); next.widgets = next.widgets.filter((w) => w.id !== id); return next; });
  }, [clone]);

  return { layout, selectedWidgetId, selectedWidget, selectWidget, addWidget, updateWidget, removeWidget, validateBeforeSave, exportYaml, importYaml };
}
