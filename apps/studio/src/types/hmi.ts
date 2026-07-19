/**
 * HMI (Human-Machine Interface) type definitions for AUDESYS Studio.
 * Defines the layout model for HMI builder screens.
 */

/** Position of a widget on the HMI canvas, in pixels from top-left origin. */
export interface HmiWidgetPosition {
  /** Pixels from the left edge of the canvas */
  x: number;
  /** Pixels from the top edge of the canvas */
  y: number;
}

/** Dimensions of an HMI widget in pixels. */
export interface HmiWidgetSize {
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/**
 * Available HMI widget types.
 * - `gauge`: circular or linear gauge displaying a value relative to min/max
 * - `button`: clickable button that triggers an action
 * - `text`: static or dynamic text label
 * - `indicator`: binary or multi-state status indicator lamp
 * - `trend`: time-series chart for signal history
 * - `tank`: fluid level tank visualization
 * - `display`: generic numeric/string value display
 */
export type HmiWidgetType =
  | "gauge"
  | "button"
  | "text"
  | "indicator"
  | "trend"
  | "tank"
  | "display";

/**
 * Runtime state of a single HMI widget.
 * Represents one widget instance on the HMI canvas.
 */
export interface HmiWidgetState {
  /** Unique widget identifier (UUID v4) */
  id: string;
  /** Widget type determining visual representation */
  type: HmiWidgetType;
  /** Canvas position */
  position: HmiWidgetPosition;
  /** Canvas dimensions */
  size: HmiWidgetSize;
  /** User-facing label displayed on or near the widget */
  label: string;
  /**
   * HAL signal binding in dot notation (e.g. "axis.0.pos").
   * When undefined, the widget displays static/placeholder data.
   */
  signal?: string;
  /**
   * Widget-specific configuration values.
   * Common keys: min, max, unit, color, precision, orientation.
   */
  config: Record<string, unknown>;
}

/**
 * Complete HMI layout — the serializable document format
 * for the HMI builder. Saved/loaded via Tauri filesystem.
 */
export interface HmiLayout {
  /** Schema version for forward compatibility */
  version: 1;
  /** User-assigned layout name */
  name: string;
  /** Canvas width in pixels (default 1200) */
  canvasWidth: number;
  /** Canvas height in pixels (default 800) */
  canvasHeight: number;
  /** Ordered list of widgets on the canvas */
  widgets: HmiWidgetState[];
}
