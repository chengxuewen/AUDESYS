/**
 * HMI type definitions — copied from apps/studio/src/types/hmi.ts
 */

/** Position of a widget on the HMI canvas, in pixels from top-left origin. */
export interface HmiWidgetPosition {
  x: number;
  y: number;
}

/** Dimensions of an HMI widget in pixels. */
export interface HmiWidgetSize {
  width: number;
  height: number;
}

export type HmiWidgetType =
  | "gauge"
  | "button"
  | "text"
  | "indicator"
  | "trend"
  | "tank"
  | "display";

export interface HmiWidgetState {
  id: string;
  type: HmiWidgetType;
  position: HmiWidgetPosition;
  size: HmiWidgetSize;
  label: string;
  signal?: string;
  config: Record<string, unknown>;
}

export interface HmiLayout {
  version: 1;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  widgets: HmiWidgetState[];
}
