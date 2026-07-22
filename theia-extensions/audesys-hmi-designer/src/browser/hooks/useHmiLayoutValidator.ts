import type { HmiLayout } from "../types/hmi";

const MIN_SIZES: Record<string, { width: number; height: number }> = {
  gauge: { width: 40, height: 40 },
  trend: { width: 80, height: 80 },
};
const DEFAULT_MIN_SIZE = { width: 20, height: 20 };
const DEFAULT_MAX_WIDGETS = 50;
const WARN_WIDGETS = 30;

export interface ValidationResult { errors: string[]; warnings: string[]; }
export interface ValidationOptions { canvasWidth?: number; canvasHeight?: number; signalNames?: string[]; maxWidgets?: number; }

export function validateLayout(layout: HmiLayout, options?: ValidationOptions): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const maxW = options?.maxWidgets ?? DEFAULT_MAX_WIDGETS;
  const cw = options?.canvasWidth ?? layout.canvasWidth;
  const ch = options?.canvasHeight ?? layout.canvasHeight;

  const count = layout.widgets.length;
  if (count === 0) { errors.push(`layout must contain at least 1 widget`); }
  else if (count > maxW) { errors.push(`widget count ${count} exceeds maximum of ${maxW}`); }
  else if (count > WARN_WIDGETS) { warnings.push(`widget count ${count} exceeds recommended limit of ${WARN_WIDGETS}`); }

  const seenIds = new Set<string>();
  for (const w of layout.widgets) {
    const prefix = w.id ? `widget '${w.id}'` : `widget at index ${layout.widgets.indexOf(w)}`;
    if (!w.id) errors.push(`widget missing required field 'id'`);
    if (!w.type) errors.push(`${prefix} missing required field 'type'`);
    if (w.position) {
      if (w.position.x < 0) errors.push(`${prefix} has negative position x=${w.position.x}`);
      if (w.position.y < 0) errors.push(`${prefix} has negative position y=${w.position.y}`);
      if (w.size && w.position.x + w.size.width > cw) errors.push(`${prefix} exceeds canvas boundary (x+width=${w.position.x + w.size.width} > ${cw})`);
      if (w.size && w.position.y + w.size.height > ch) errors.push(`${prefix} exceeds canvas boundary (y+height=${w.position.y + w.size.height} > ${ch})`);
    }
    if (w.size) {
      if (w.size.width <= 0) errors.push(`${prefix} has invalid dimensions: width=${w.size.width}`);
      if (w.size.height <= 0) errors.push(`${prefix} has invalid dimensions: height=${w.size.height}`);
      const minSize = MIN_SIZES[w.type] ?? DEFAULT_MIN_SIZE;
      if (w.size.width > 0 && w.size.width < minSize.width) errors.push(`${prefix} width ${w.size.width} below minimum ${minSize.width} for type '${w.type}'`);
      if (w.size.height > 0 && w.size.height < minSize.height) errors.push(`${prefix} height ${w.size.height} below minimum ${minSize.height} for type '${w.type}'`);
    }
    if (w.id) {
      if (seenIds.has(w.id)) errors.push(`duplicate widget id '${w.id}'`);
      seenIds.add(w.id);
    }
    if (w.signal && options?.signalNames && !options.signalNames.includes(w.signal)) {
      warnings.push(`${prefix} bound to unknown signal '${w.signal}'`);
    }
    if (w.type === "gauge") {
      const min = w.config?.min; const max = w.config?.max;
      if (typeof min === "number" && typeof max === "number" && min >= max) errors.push(`${prefix}: min (${min}) must be less than max (${max})`);
    }
    if (w.type === "trend") {
      const timespan = w.config?.timespan;
      if (typeof timespan === "number" && timespan <= 0) errors.push(`${prefix}: timespan (${timespan}) must be greater than 0`);
    }
  }
  return { errors, warnings };
}
