import { useState, useCallback, useMemo } from "react";
import type { HmiLayout, HmiWidgetState, HmiWidgetType, HmiWidgetPosition, HmiWidgetSize } from "../types/hmi";
const DEFAULT_CANVAS = { width: 1200, height: 800 };

/**
 * Creates a new empty HMI layout with default canvas dimensions.
 */
function createEmptyLayout(name: string): HmiLayout {
  return {
    version: 1,
    name,
    canvasWidth: DEFAULT_CANVAS.width,
    canvasHeight: DEFAULT_CANVAS.height,
    widgets: [],
  };
}

/**
 * React hook for managing an HmiLayout with immutable update operations.
 * All mutation methods return a new layout object — the original is never modified.
 */
export function useHmiLayout(initialLayout?: HmiLayout) {
  const [layout, setLayout] = useState<HmiLayout>(
    initialLayout ?? createEmptyLayout("Untitled"),
  );

  /** Deep-clone layout for safe immutable updates. */
  const clone = useCallback((l: HmiLayout): HmiLayout => {
    return JSON.parse(JSON.stringify(l)) as HmiLayout;
  }, []);

  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);

  /** The currently selected widget (or null) */
  const selectedWidget = useMemo(() => {
    if (!selectedWidgetId) return null;
    return layout.widgets.find((w) => w.id === selectedWidgetId) ?? null;
  }, [layout.widgets, selectedWidgetId]);

  /** Select a widget by id. Pass null to deselect. */
  const selectWidget = useCallback((id: string | null) => {
    setSelectedWidgetId(id);
  }, []);

  /** Export layout as YAML string */
  const exportYaml = useCallback((): string => {
    const jsYaml = (window as any).__jsyaml;
    if (jsYaml?.dump) return jsYaml.dump(layout);
    // Fallback: simple JSON string wrapped for YAML compatibility
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
      // ponytail: simple YAML dump, replace with js-yaml.dump() when installed
    }
    return lines.join('\n');
  }, [layout]);

  /** Import layout from YAML string */
  const importYaml = useCallback((yamlStr: string) => {
    const jsYaml = (window as any).__jsyaml;
    if (jsYaml?.load) {
      const loaded = jsYaml.load(yamlStr) as HmiLayout;
      setLayout(clone(loaded));
      return;
    }
    // Try JSON parse as fallback
    try {
      const parsed = JSON.parse(yamlStr) as HmiLayout;
      setLayout(clone(parsed));
    } catch {
      // ponytail: skip if neither YAML nor JSON
    }
  }, [clone]);

  /** Add a new widget to the canvas. Returns the generated widget id. */
  const addWidget = useCallback(
    (type: HmiWidgetType, position: HmiWidgetPosition, size: HmiWidgetSize, label: string): string => {
      const id = crypto.randomUUID();
      const widget: HmiWidgetState = {
        id,
        type,
        position,
        size,
        label,
        config: {},
      };
      setLayout((prev) => {
        const next = clone(prev);
        next.widgets.push(widget);
        return next;
      });
      return id;
    },
    [clone],
  );

  /** Partially update an existing widget's state. */
  const updateWidget = useCallback(
    (id: string, patch: Partial<Omit<HmiWidgetState, "id">>): void => {
      setLayout((prev) => {
        const next = clone(prev);
        const idx = next.widgets.findIndex((w) => w.id === id);
        if (idx === -1) return prev;
        next.widgets[idx] = { ...next.widgets[idx], ...patch };
        return next;
      });
    },
    [clone],
  );

  /** Remove a widget from the canvas. */
  const removeWidget = useCallback(
    (id: string): void => {
      setLayout((prev) => {
        const next = clone(prev);
        next.widgets = next.widgets.filter((w) => w.id !== id);
        return next;
      });
    },
    [clone],
  );

  /** Move a widget to a new position. */
  const moveWidget = useCallback(
    (id: string, position: HmiWidgetPosition): void => {
      updateWidget(id, { position });
    },
    [updateWidget],
  );

  /** Resize a widget to new dimensions. */
  const resizeWidget = useCallback(
    (id: string, size: HmiWidgetSize): void => {
      updateWidget(id, { size });
    },
    [updateWidget],
  );

  /** Bind or unbind a HAL signal to/from a widget. Pass undefined to unbind. */
  const bindSignal = useCallback(
    (id: string, signal: string | undefined): void => {
      updateWidget(id, { signal });
    },
    [updateWidget],
  );

  /** Update widget-specific config (partial merge). */
  const updateConfig = useCallback(
    (id: string, config: Record<string, unknown>): void => {
      setLayout((prev) => {
        const next = clone(prev);
        const idx = next.widgets.findIndex((w) => w.id === id);
        if (idx === -1) return prev;
        next.widgets[idx] = {
          ...next.widgets[idx],
          config: { ...next.widgets[idx].config, ...config },
        };
        return next;
      });
    },
    [clone],
  );

  /** Replace the entire layout (e.g. after loading from disk). */
  const replaceLayout = useCallback((newLayout: HmiLayout): void => {
    setLayout(clone(newLayout));
  }, [clone]);

  /** Set the canvas dimensions. */
  const setCanvasSize = useCallback(
    (width: number, height: number): void => {
      setLayout((prev) => {
        const next = clone(prev);
        next.canvasWidth = width;
        next.canvasHeight = height;
        return next;
      });
    },
    [clone],
  );

    layout,
    selectedWidgetId,
    selectedWidget,
    selectWidget,
    addWidget,
    updateWidget,
    removeWidget,
    moveWidget,
    resizeWidget,
    bindSignal,
    updateConfig,
    replaceLayout,
    setCanvasSize,
    exportYaml,
    importYaml,

}
