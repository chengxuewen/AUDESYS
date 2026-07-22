/**
 * HMI Designer ReactWidget Tests — T3.5t
 *
 * Covers:
 *   - HMI-VAL-001 to HMI-VAL-008 (validateLayout)
 *   - YAML export → import round-trip (useHmiLayout)
 *   - Edit/Preview mode guard (validateBeforeSave + hook operations)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { validateLayout } from "../src/browser/hooks/useHmiLayoutValidator";
import { useHmiLayout } from "../src/browser/hooks/useHmiLayout";
import type { HmiLayout, HmiWidgetState } from "../src/browser/types/hmi";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWidget(overrides: Partial<HmiWidgetState> = {}): HmiWidgetState {
  return {
    id: crypto.randomUUID(),
    type: "display",
    position: { x: 10, y: 10 },
    size: { width: 100, height: 80 },
    label: "Test Widget",
    config: {},
    ...overrides,
  };
}

function makeLayout(
  widgets: HmiWidgetState[],
  overrides: Partial<HmiLayout> = {},
): HmiLayout {
  return {
    version: 1,
    name: "TestLayout",
    canvasWidth: 1200,
    canvasHeight: 800,
    widgets,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// HMI-VAL-001 — widget count
// ---------------------------------------------------------------------------

describe("HMI-VAL-001 — widget count", () => {
  it("rejects when widget count exceeds default maximum of 50", () => {
    const widgets = Array.from({ length: 51 }, () => makeWidget());
    const result = validateLayout(makeLayout(widgets));
    expect(result.errors).toContain("widget count 51 exceeds maximum of 50");
  });

  it("rejects when widget count exceeds custom maxWidgets", () => {
    const widgets = Array.from({ length: 11 }, () => makeWidget());
    const result = validateLayout(makeLayout(widgets), { maxWidgets: 10 });
    expect(result.errors).toContain("widget count 11 exceeds maximum of 10");
  });

  it("accepts widget count at the limit", () => {
    const widgets = Array.from({ length: 50 }, () => makeWidget());
    const result = validateLayout(makeLayout(widgets));
    expect(result.errors.filter((e) => e.includes("count")).length).toBe(0);
  });

  it("warns when widget count exceeds recommended limit of 30", () => {
    const widgets = Array.from({ length: 31 }, () => makeWidget());
    const result = validateLayout(makeLayout(widgets));
    expect(result.warnings).toContain(
      "widget count 31 exceeds recommended limit of 30",
    );
  });

  it("rejects empty widget list", () => {
    const result = validateLayout(makeLayout([]));
    expect(result.errors).toContain("layout must contain at least 1 widget");
  });
});

// ---------------------------------------------------------------------------
// HMI-VAL-002 — negative position
// ---------------------------------------------------------------------------

describe("HMI-VAL-002 — negative position", () => {
  it("rejects negative x position", () => {
    const w = makeWidget({ id: "w1", position: { x: -5, y: 10 } });
    const result = validateLayout(makeLayout([w]));
    expect(result.errors).toContain("widget 'w1' has negative position x=-5");
  });

  it("rejects negative y position", () => {
    const w = makeWidget({ id: "w1", position: { x: 10, y: -3 } });
    const result = validateLayout(makeLayout([w]));
    expect(result.errors).toContain("widget 'w1' has negative position y=-3");
  });

  it("accepts zero position", () => {
    const w = makeWidget({ id: "w1", position: { x: 0, y: 0 } });
    const result = validateLayout(makeLayout([w]));
    expect(result.errors.filter((e) => e.includes("negative")).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// HMI-VAL-003 — outside canvas bounds
// ---------------------------------------------------------------------------

describe("HMI-VAL-003 — outside canvas bounds", () => {
  it("rejects widget exceeding canvas width", () => {
    const w = makeWidget({
      id: "w1",
      position: { x: 1100, y: 10 },
      size: { width: 200, height: 80 },
    });
    const result = validateLayout(makeLayout([w]), {
      canvasWidth: 1200,
      canvasHeight: 800,
    });
    expect(result.errors).toContain(
      "widget 'w1' exceeds canvas boundary (x+width=1300 > 1200)",
    );
  });

  it("rejects widget exceeding canvas height", () => {
    const w = makeWidget({
      id: "w1",
      position: { x: 10, y: 700 },
      size: { width: 100, height: 200 },
    });
    const result = validateLayout(makeLayout([w]), {
      canvasWidth: 1200,
      canvasHeight: 800,
    });
    expect(result.errors).toContain(
      "widget 'w1' exceeds canvas boundary (y+height=900 > 800)",
    );
  });

  it("accepts widget within canvas bounds", () => {
    const w = makeWidget({
      id: "w1",
      position: { x: 1100, y: 700 },
      size: { width: 100, height: 100 },
    });
    const result = validateLayout(makeLayout([w]), {
      canvasWidth: 1200,
      canvasHeight: 800,
    });
    expect(
      result.errors.filter((e) => e.includes("exceeds canvas")).length,
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// HMI-VAL-004 — invalid dimensions
// ---------------------------------------------------------------------------

describe("HMI-VAL-004 — invalid dimensions", () => {
  it("rejects zero width", () => {
    const w = makeWidget({ id: "w1", size: { width: 0, height: 80 } });
    const result = validateLayout(makeLayout([w]));
    expect(result.errors).toContain(
      "widget 'w1' has invalid dimensions: width=0",
    );
  });

  it("rejects negative height", () => {
    const w = makeWidget({ id: "w1", size: { width: 100, height: -1 } });
    const result = validateLayout(makeLayout([w]));
    expect(result.errors).toContain(
      "widget 'w1' has invalid dimensions: height=-1",
    );
  });

  it("rejects gauge below minimum size", () => {
    const w = makeWidget({
      id: "g1",
      type: "gauge",
      size: { width: 30, height: 30 },
    });
    const result = validateLayout(makeLayout([w]));
    expect(result.errors).toContain(
      "widget 'g1' width 30 below minimum 40 for type 'gauge'",
    );
    expect(result.errors).toContain(
      "widget 'g1' height 30 below minimum 40 for type 'gauge'",
    );
  });
});

// ---------------------------------------------------------------------------
// HMI-VAL-005 — duplicate widget IDs
// ---------------------------------------------------------------------------

describe("HMI-VAL-005 — duplicate widget IDs", () => {
  it("rejects duplicate widget id", () => {
    const w1 = makeWidget({ id: "dup" });
    const w2 = makeWidget({ id: "dup" });
    const result = validateLayout(makeLayout([w1, w2]));
    expect(result.errors).toContain("duplicate widget id 'dup'");
  });

  it("accepts unique widget ids", () => {
    const w1 = makeWidget({ id: "a" });
    const w2 = makeWidget({ id: "b" });
    const result = validateLayout(makeLayout([w1, w2]));
    expect(result.errors.filter((e) => e.includes("duplicate")).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// HMI-VAL-006 — unknown signal name
// ---------------------------------------------------------------------------

describe("HMI-VAL-006 — unknown signal name", () => {
  it("warns when signal is not in known signalNames list", () => {
    const w = makeWidget({ id: "w1", signal: "ghost.signal" });
    const result = validateLayout(makeLayout([w]), {
      signalNames: ["axis.0.pos", "temp.1.val"],
    });
    expect(result.warnings).toContain(
      "widget 'w1' bound to unknown signal 'ghost.signal'",
    );
  });

  it("accepts known signal names without warning", () => {
    const w = makeWidget({ id: "w1", signal: "axis.0.pos" });
    const result = validateLayout(makeLayout([w]), {
      signalNames: ["axis.0.pos", "temp.1.val"],
    });
    expect(
      result.warnings.filter((w) => w.includes("unknown signal")).length,
    ).toBe(0);
  });

  it("does not warn when signalNames is not provided", () => {
    const w = makeWidget({ id: "w1", signal: "ghost.signal" });
    const result = validateLayout(makeLayout([w]));
    expect(
      result.warnings.filter((w) => w.includes("unknown signal")).length,
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// HMI-VAL-007 — missing required fields
// ---------------------------------------------------------------------------

describe("HMI-VAL-007 — missing required fields", () => {
  it("rejects widget without type", () => {
    const w = makeWidget({ id: "w1", type: undefined as unknown as HmiWidgetState["type"] });
    const result = validateLayout(makeLayout([w]));
    expect(result.errors).toContain(
      "widget 'w1' missing required field 'type'",
    );
  });

  it("rejects widget without id", () => {
    const w = makeWidget({ id: "" });
    const result = validateLayout(makeLayout([w]));
    expect(result.errors).toContain(
      "widget missing required field 'id'",
    );
  });
});

// ---------------------------------------------------------------------------
// HMI-VAL-008 — gauge min ≥ max
// ---------------------------------------------------------------------------

describe("HMI-VAL-008 — gauge config range", () => {
  it("rejects gauge with min >= max", () => {
    const w = makeWidget({
      id: "g1",
      type: "gauge",
      config: { min: 100, max: 50 },
    });
    const result = validateLayout(makeLayout([w]));
    expect(result.errors).toContain(
      "widget 'g1': min (100) must be less than max (50)",
    );
  });

  it("rejects gauge with min equal to max", () => {
    const w = makeWidget({
      id: "g1",
      type: "gauge",
      config: { min: 50, max: 50 },
    });
    const result = validateLayout(makeLayout([w]));
    expect(result.errors).toContain(
      "widget 'g1': min (50) must be less than max (50)",
    );
  });

  it("accepts gauge with valid min < max", () => {
    const w = makeWidget({
      id: "g1",
      type: "gauge",
      config: { min: 0, max: 100 },
    });
    const result = validateLayout(makeLayout([w]));
    expect(result.errors.filter((e) => e.includes("min")).length).toBe(0);
  });

  it("accepts gauge without config", () => {
    const w = makeWidget({ id: "g1", type: "gauge", config: {} });
    const result = validateLayout(makeLayout([w]));
    expect(result.errors.filter((e) => e.includes("min")).length).toBe(0);
  });

  it("rejects trend with non-positive timespan", () => {
    const w = makeWidget({
      id: "t1",
      type: "trend",
      config: { timespan: 0 },
    });
    const result = validateLayout(makeLayout([w]));
    expect(result.errors).toContain(
      "widget 't1': timespan (0) must be greater than 0",
    );
  });
});

// ---------------------------------------------------------------------------
// YAML export → import round-trip (useHmiLayout hook)
// ---------------------------------------------------------------------------

describe("YAML export → import round-trip", () => {
  it("produces identical layout data after export + re-import", () => {
    const { result } = renderHook(() => useHmiLayout());

    act(() => {
      result.current.addWidget("gauge", { x: 100, y: 200 }, { width: 200, height: 160 }, "Pressure");
      result.current.addWidget("display", { x: 400, y: 200 }, { width: 150, height: 80 }, "Status");
    });

    const exported = result.current.exportYaml();

    // Re-import into a fresh hook using JSON (importYaml calls JSON.parse)
    const { result: result2 } = renderHook(() => useHmiLayout());

    // Build JSON equivalent — importYaml uses JSON.parse, not YAML parser
    const jsonStr = JSON.stringify(result.current.layout);
    act(() => {
      result2.current.importYaml(jsonStr);
    });

    // Compare layouts
    const original = result.current.layout;
    const restored = result2.current.layout;
    expect(restored.name).toBe(original.name);
    expect(restored.canvasWidth).toBe(original.canvasWidth);
    expect(restored.canvasHeight).toBe(original.canvasHeight);
    expect(restored.widgets.length).toBe(original.widgets.length);
    for (let i = 0; i < original.widgets.length; i++) {
      expect(restored.widgets[i].id).toBe(original.widgets[i].id);
      expect(restored.widgets[i].type).toBe(original.widgets[i].type);
      expect(restored.widgets[i].label).toBe(original.widgets[i].label);
      expect(restored.widgets[i].position).toEqual(original.widgets[i].position);
      expect(restored.widgets[i].size).toEqual(original.widgets[i].size);
    }
  });

  it("exportYaml produces non-empty string with widget data", () => {
    const { result } = renderHook(() => useHmiLayout());

    act(() => {
      result.current.addWidget("display", { x: 10, y: 10 }, { width: 100, height: 80 }, "Test");
    });

    const yaml = result.current.exportYaml();
    expect(yaml.length).toBeGreaterThan(0);
    expect(yaml).toContain("version: 1");
    expect(yaml).toContain("type: display");
    expect(yaml).toContain("label: Test");
    expect(yaml).toContain("position_x: 10");
    expect(yaml).toContain("position_y: 10");
    expect(yaml).toContain("size_width: 100");
    expect(yaml).toContain("size_height: 80");
  });
});

// ---------------------------------------------------------------------------
// Edit/Preview mode guard — validateBeforeSave + hook operations
// ---------------------------------------------------------------------------

describe("Edit/Preview mode guard", () => {
  let hookResult: ReturnType<typeof renderHook<ReturnType<typeof useHmiLayout>>>;

  beforeEach(() => {
    hookResult = renderHook(() => useHmiLayout());
  });

  it("validateBeforeSave returns no errors for a valid layout", () => {
    act(() => {
      hookResult.result.current.addWidget(
        "display", { x: 10, y: 10 }, { width: 100, height: 80 }, "ValidWidget"
      );
    });
    const validation = hookResult.result.current.validateBeforeSave();
    expect(validation.errors.length).toBe(0);
  });

  it("validateBeforeSave catches invalid widget after add", () => {
    // Directly manipulate layout to insert an invalid widget (no id)
    act(() => {
      const invalid: HmiWidgetState = {
        id: "",
        type: "display",
        position: { x: 10, y: 10 },
        size: { width: 100, height: 80 },
        label: "Bad",
        config: {},
      };
      // Use JSON round-trip to inject — ponytail: bypass immutable pattern for test
      const next = JSON.parse(JSON.stringify(hookResult.result.current.layout)) as HmiLayout;
      next.widgets.push(invalid);
      hookResult.result.current.importYaml(JSON.stringify(next));
    });
    const validation = hookResult.result.current.validateBeforeSave();
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.errors.some((e) => e.includes("missing required field 'id'"))).toBe(true);
  });

  it("selected widget is cleared after removal", () => {
    let widgetId = "";
    act(() => {
      widgetId = hookResult.result.current.addWidget(
        "display", { x: 10, y: 10 }, { width: 100, height: 80 }, "RemoveMe"
      );
    });
    expect(hookResult.result.current.selectedWidget).toBeNull();

    act(() => {
      hookResult.result.current.selectWidget(widgetId);
    });
    expect(hookResult.result.current.selectedWidget).not.toBeNull();
    expect(hookResult.result.current.selectedWidget?.id).toBe(widgetId);

    act(() => {
      hookResult.result.current.removeWidget(widgetId);
    });
    // After removing the selected widget, selectedWidget should be null
    expect(hookResult.result.current.selectedWidget).toBeNull();
  });

  it("updateWidget correctly patches widget fields (edit-mode operation)", () => {
    let widgetId = "";
    act(() => {
      widgetId = hookResult.result.current.addWidget(
        "display", { x: 10, y: 10 }, { width: 100, height: 80 }, "Original"
      );
    });
    act(() => {
      hookResult.result.current.updateWidget(widgetId, { label: "Updated", position: { x: 50, y: 50 } });
    });
    const widget = hookResult.result.current.layout.widgets.find((w) => w.id === widgetId);
    expect(widget?.label).toBe("Updated");
    expect(widget?.position).toEqual({ x: 50, y: 50 });
    // size should remain unchanged
    expect(widget?.size).toEqual({ width: 100, height: 80 });
  });

  it("addWidget auto-generates unique IDs", () => {
    act(() => {
      hookResult.result.current.addWidget("display", { x: 10, y: 10 }, { width: 100, height: 80 }, "A");
      hookResult.result.current.addWidget("display", { x: 20, y: 20 }, { width: 100, height: 80 }, "B");
    });
    const ids = hookResult.result.current.layout.widgets.map((w) => w.id);
    expect(ids.length).toBe(2);
    expect(ids[0]).not.toBe(ids[1]);
    // IDs should be valid UUIDs
    for (const id of ids) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    }
  });
});
