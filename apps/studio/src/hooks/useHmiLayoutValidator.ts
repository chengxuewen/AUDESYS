/**
 * HMI layout validation per openspec/specs/hmi-spec.md HMI-VAL-001 to HMI-VAL-008.
 * Runs before saving a layout. Errors block save, warnings allow save with confirmation.
 */

import type { HmiLayout } from "../types/hmi";

const MIN_SIZES: Record<string, { width: number; height: number }> = {
  gauge: { width: 40, height: 40 },
  trend: { width: 80, height: 80 },
};

const DEFAULT_MIN_SIZE = { width: 20, height: 20 };

const DEFAULT_MAX_WIDGETS = 50;
const WARN_WIDGETS = 30;

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export interface ValidationOptions {
  canvasWidth?: number;
  canvasHeight?: number;
  signalNames?: string[];
  maxWidgets?: number;
}

export function validateLayout(
  layout: HmiLayout,
  options?: ValidationOptions,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const maxW = options?.maxWidgets ?? DEFAULT_MAX_WIDGETS;
  const cw = options?.canvasWidth ?? layout.canvasWidth;
  const ch = options?.canvasHeight ?? layout.canvasHeight;

  // HMI-VAL-001: widget count
  const count = layout.widgets.length;
  if (count === 0) {
    errors.push(`layout must contain at least 1 widget`);
  } else if (count > maxW) {
    errors.push(`widget count ${count} exceeds maximum of ${maxW}`);
  } else if (count > WARN_WIDGETS) {
    warnings.push(
      `widget count ${count} exceeds recommended limit of ${WARN_WIDGETS}`,
    );
  }

  const seenIds = new Set<string>();

  for (let i = 0; i < layout.widgets.length; i++) {
    const w = layout.widgets[i];
    const prefix = w.id ? `widget '${w.id}'` : `widget at index ${i}`;

    // HMI-VAL-007: required fields
    if (!w.id) {
      errors.push(`widget at index ${i} missing required field 'id'`);
    }
    if (!w.type) {
      errors.push(`${prefix} missing required field 'type'`);
    }
    if (w.position === undefined || w.position === null) {
      errors.push(`${prefix} missing required field 'position'`);
    } else {
      // HMI-VAL-002: non-negative position
      if (w.position.x < 0) {
        errors.push(`${prefix} has negative position x=${w.position.x}`);
      }
      if (w.position.y < 0) {
        errors.push(`${prefix} has negative position y=${w.position.y}`);
      }

      // HMI-VAL-003: within canvas
      if (w.size) {
        if (w.position.x + w.size.width > cw) {
          errors.push(`${prefix} exceeds canvas boundary (x+width=${w.position.x + w.size.width} > ${cw})`);
        }
        if (w.position.y + w.size.height > ch) {
          errors.push(`${prefix} exceeds canvas boundary (y+height=${w.position.y + w.size.height} > ${ch})`);
        }
      }
    }

    // HMI-VAL-004: valid dimensions
    if (w.size) {
      if (w.size.width <= 0) {
        errors.push(`${prefix} has invalid dimensions: width=${w.size.width}`);
      }
      if (w.size.height <= 0) {
        errors.push(`${prefix} has invalid dimensions: height=${w.size.height}`);
      }
      const minSize = MIN_SIZES[w.type] ?? DEFAULT_MIN_SIZE;
      if (w.size.width > 0 && w.size.width < minSize.width) {
        errors.push(`${prefix} width ${w.size.width} below minimum ${minSize.width} for type '${w.type}'`);
      }
      if (w.size.height > 0 && w.size.height < minSize.height) {
        errors.push(`${prefix} height ${w.size.height} below minimum ${minSize.height} for type '${w.type}'`);
      }
    }

    // HMI-VAL-005: unique IDs (only for widgets that have IDs)
    if (w.id) {
      if (seenIds.has(w.id)) {
        errors.push(`duplicate widget id '${w.id}'`);
      }
      seenIds.add(w.id);
    }

    // HMI-VAL-006: signal name validity
    if (w.signal && options?.signalNames) {
      if (!options.signalNames.includes(w.signal)) {
        warnings.push(`${prefix} bound to unknown signal '${w.signal}'`);
      }
    }

    // HMI-VAL-008: type-specific config
    if (w.type === "gauge") {
      const min = w.config?.min;
      const max = w.config?.max;
      if (typeof min === "number" && typeof max === "number" && min >= max) {
        errors.push(`${prefix}: min (${min}) must be less than max (${max})`);
      }
    }
    if (w.type === "trend") {
      const timespan = w.config?.timespan;
      if (typeof timespan === "number" && timespan <= 0) {
        errors.push(`${prefix}: timespan (${timespan}) must be greater than 0`);
      }
    }
  }

  return { errors, warnings };
}
