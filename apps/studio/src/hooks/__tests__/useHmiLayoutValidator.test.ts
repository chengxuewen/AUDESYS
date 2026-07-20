import { describe, it, expect } from "vitest";
import { validateLayout } from "../useHmiLayoutValidator";
import type { HmiLayout } from "../../types/hmi";

function makeLayout(overrides: Partial<HmiLayout> = {}): HmiLayout {
  return {
    version: 1,
    name: "Test Layout",
    canvasWidth: 1920,
    canvasHeight: 1080,
    widgets: [],
    ...overrides,
  };
}

function makeWidget(overrides: Record<string, unknown> = {}) {
  return {
    id: "gauge-1",
    type: "gauge" as const,
    position: { x: 100, y: 100 },
    size: { width: 200, height: 200 },
    label: "Test Gauge",
    config: {},
    ...overrides,
  };
}

describe("validateLayout", () => {
  it("rejects empty layout", () => {
    const result = validateLayout(makeLayout({ widgets: [] }));
    expect(result.errors).toContain("layout must contain at least 1 widget");
  });

  it("warns when widget count exceeds 30", () => {
    const widgets = Array.from({ length: 35 }, (_, i) =>
      makeWidget({ id: `w-${i}`, position: { x: i * 10, y: 0 } }),
    );
    const result = validateLayout(makeLayout({ widgets }));
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("exceeds recommended limit"),
      ]),
    );
  });

  it("errors when widget count exceeds max (default 50)", () => {
    const widgets = Array.from({ length: 51 }, (_, i) =>
      makeWidget({ id: `w-${i}`, position: { x: i * 10, y: 0 } }),
    );
    const result = validateLayout(makeLayout({ widgets }));
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("exceeds maximum")]),
    );
  });

  it("errors on negative position", () => {
    const result = validateLayout(
      makeLayout({ widgets: [makeWidget({ position: { x: -10, y: 100 } })] }),
    );
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("negative position")]),
    );
  });

  it("errors when widget exceeds canvas boundary", () => {
    const result = validateLayout(
      makeLayout({
        canvasWidth: 800,
        canvasHeight: 600,
        widgets: [
          makeWidget({
            position: { x: 700, y: 500 },
            size: { width: 200, height: 200 },
          }),
        ],
      }),
    );
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("exceeds canvas boundary")]),
    );
  });

  it("errors on zero width", () => {
    const result = validateLayout(
      makeLayout({
        widgets: [makeWidget({ size: { width: 0, height: 100 } })],
      }),
    );
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("invalid dimensions")]),
    );
  });

  it("errors on widget below minimum size for type", () => {
    const result = validateLayout(
      makeLayout({
        widgets: [
          makeWidget({
            type: "gauge",
            size: { width: 30, height: 30 },
          }),
        ],
      }),
    );
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("below minimum")]),
    );
  });

  it("errors on duplicate widget IDs", () => {
    const result = validateLayout(
      makeLayout({
        widgets: [
          makeWidget({ id: "dup-1", position: { x: 0, y: 0 } }),
          makeWidget({ id: "dup-1", position: { x: 100, y: 100 } }),
        ],
      }),
    );
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("duplicate widget id")]),
    );
  });

  it("warns on unknown signal binding", () => {
    const result = validateLayout(
      makeLayout({
        widgets: [makeWidget({ signal: "axis.99.pos" })],
      }),
      { signalNames: ["axis.0.pos", "axis.1.pos"] },
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("unknown signal")]),
    );
  });

  it("does not warn on known signal binding", () => {
    const result = validateLayout(
      makeLayout({
        widgets: [makeWidget({ signal: "axis.0.pos" })],
      }),
      { signalNames: ["axis.0.pos"] },
    );
    expect(result.warnings).toHaveLength(0);
  });

  it("errors on missing required field", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = validateLayout(makeLayout({ widgets: [{ id: "x" } as any] }));
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("missing required field")]),
    );
  });

  it("errors on gauge min >= max", () => {
    const result = validateLayout(
      makeLayout({
        widgets: [
          makeWidget({ type: "gauge", config: { min: 100, max: 0 } }),
        ],
      }),
    );
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("must be less than max")]),
    );
  });

  it("passes on valid layout", () => {
    const result = validateLayout(
      makeLayout({
        widgets: [
          makeWidget({ id: "w1", position: { x: 10, y: 10 }, size: { width: 100, height: 100 } }),
          makeWidget({ id: "w2", type: "trend", position: { x: 200, y: 0 }, size: { width: 200, height: 160 }, label: "Trend", config: { timespan: 30 } }),
          makeWidget({ id: "w3", type: "button", position: { x: 0, y: 200 }, size: { width: 80, height: 40 }, label: "Start", signal: "pump.0.start" }),
        ],
      }),
    );
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});
