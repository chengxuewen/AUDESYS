import type { HmiLayout } from "../types/hmi";

/** Default demo layout with 6 industrial widgets for development/test. */
export const DEMO_LAYOUT: HmiLayout = {
  version: 1,
  name: "Demo Panel",
  canvasWidth: 1920,
  canvasHeight: 1080,
  widgets: [
    {
      id: "gauge-1",
      type: "gauge",
      position: { x: 50, y: 50 },
      size: { width: 260, height: 260 },
      label: "泵速",
      signal: "pump.0.speed",
      config: { min: 0, max: 3000, unit: "RPM" },
    },
    {
      id: "tank-1",
      type: "tank",
      position: { x: 360, y: 50 },
      size: { width: 200, height: 300 },
      label: "液位",
      signal: "tank.level",
      config: { min: 0, max: 100, unit: "%" },
    },
    {
      id: "display-1",
      type: "display",
      position: { x: 610, y: 50 },
      size: { width: 220, height: 80 },
      label: "温度",
      signal: "temp.reactor",
      config: { unit: "°C" },
    },
    {
      id: "indicator-1",
      type: "indicator",
      position: { x: 50, y: 360 },
      size: { width: 80, height: 80 },
      label: "电机状态",
      signal: "motor.current",
      config: { thresholds: { ok: 20, warn: 25 } },
    },
    {
      id: "text-1",
      type: "text",
      position: { x: 180, y: 360 },
      size: { width: 300, height: 40 },
      label: "产线状态",
      signal: undefined,
      config: { fontSize: 18, color: "#a0a0b0", text: "运行中 — 产线 A" },
    },
    {
      id: "button-1",
      type: "button",
      position: { x: 610, y: 180 },
      size: { width: 160, height: 60 },
      label: "紧急停机",
      signal: undefined,
      config: { onColor: "#FF4444", offColor: "#2a2a30" },
    },
  ],
};

/** Parse a YAML/JSON string into an HmiLayout. Returns null on failure. */
export function loadLayoutFromYaml(yaml: string): HmiLayout | null {
  try {
    return JSON.parse(yaml) as HmiLayout;
  } catch {
    return null;
  }
}
