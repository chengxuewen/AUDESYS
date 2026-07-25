/**
 * LD→Runtime Panel Signal Validation Tests
 *
 * Validates that HMI widget signal bindings conform to the
 * AUDESYS HAL signal naming convention (component.interface.name)
 * and that the validateLayout function catches signal-related errors.
 */
import { describe, it, expect } from "vitest";
import { validateLayout } from "../src/browser/hooks/useHmiLayoutValidator";
import type { HmiWidgetState } from "../src/browser/types/hmi";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWidget(overrides: Partial<HmiWidgetState> = {}): HmiWidgetState {
  return {
    id: crypto.randomUUID(),
    type: "display",
    position: { x: 10, y: 10 },
    size: { width: 100, height: 80 },
    label: "Test",
    config: {},
    ...overrides,
  };
}

function makeLayout(widgets: HmiWidgetState[]) {
  return { version: 1 as const, name: "Test", canvasWidth: 1200, canvasHeight: 800, widgets };
}

// ---------------------------------------------------------------------------
// Signal naming convention: component.interface.name
// ---------------------------------------------------------------------------

describe("Signal naming convention validation", () => {
  it("accepts valid 'component.interface.name' signal names", () => {
    const w = makeWidget({ id: "w1", signal: "axis.0.pos" });
    const result = validateLayout(makeLayout([w]), {
      signalNames: ["axis.0.pos", "temp.1.val", "pump.status"],
    });
    expect(
      result.warnings.filter((w) => w.includes("unknown signal")).length
    ).toBe(0);
  });

  it("accepts two-segment signal names (component.name)", () => {
    const w = makeWidget({ id: "w1", signal: "motor.speed" });
    const result = validateLayout(makeLayout([w]), {
      signalNames: ["motor.speed"],
    });
    expect(
      result.warnings.filter((w) => w.includes("unknown signal")).length
    ).toBe(0);
  });

  it("accepts deep nested signal names", () => {
    const w = makeWidget({ id: "w1", signal: "motion.axis.x.velocity" });
    const result = validateLayout(makeLayout([w]), {
      signalNames: ["motion.axis.x.velocity"],
    });
    expect(
      result.warnings.filter((w) => w.includes("unknown signal")).length
    ).toBe(0);
  });

  it("warns when signal is not in known signalNames list", () => {
    // This validates that unknown controller signals trigger a warning
    const w1 = makeWidget({ id: "w1", signal: "axis.0.pos" });
    const w2 = makeWidget({ id: "w2", signal: "ghost.channel" });
    const result = validateLayout(makeLayout([w1, w2]), {
      signalNames: ["axis.0.pos"],
    });
    expect(result.warnings).toContain(
      "widget 'w2' bound to unknown signal 'ghost.channel'"
    );
  });

  it("accepts multiple widgets bound to the same signal (multicast pattern)", () => {
    // HAL Signal is single-write-multi-read — multiple widgets same signal is valid
    const w1 = makeWidget({ id: "gauge1", type: "gauge", signal: "temp.1.val", config: { min: 0, max: 100 } });
    const w2 = makeWidget({ id: "display1", type: "display", signal: "temp.1.val" });
    const result = validateLayout(makeLayout([w1, w2]), {
      signalNames: ["temp.1.val"],
    });
    expect(result.errors.length).toBe(0);
  });

  it("accepts widget with no signal binding (no warning for optional signal)", () => {
    const w = makeWidget({ id: "w1", signal: undefined });
    const result = validateLayout(makeLayout([w]), {
      signalNames: ["axis.0.pos"],
    });
    // No error, no warning — signal is optional
    expect(result.errors.length).toBe(0);
    expect(
      result.warnings.filter((w) => w.includes("unknown signal")).length
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// LD→Runtime: compiler signal output matches HMI signal input
// ---------------------------------------------------------------------------

describe("LD→Runtime signal output validation", () => {
  it("validates that LD program output signals match HMI bindings", () => {
    // Simulate: LD compiler outputs signals like "ld.out.0", "ld.out.1"
    // HMI widgets should bind to known controller signals
    const ldOutputSignals = ["ld.out.0", "ld.out.1", "ld.timer.q"];

    const gaugeWidget = makeWidget({
      id: "g1",
      type: "gauge",
      signal: "ld.out.0",
      config: { min: 0, max: 100 },
    });
    const indicatorWidget = makeWidget({
      id: "i1",
      type: "indicator",
      signal: "ld.timer.q",
    });

    const result = validateLayout(makeLayout([gaugeWidget, indicatorWidget]), {
      signalNames: ldOutputSignals,
    });
    expect(result.errors.length).toBe(0);
    expect(
      result.warnings.filter((w) => w.includes("unknown signal")).length
    ).toBe(0);
  });

  it("detects HMI widget bound to signal not produced by LD program", () => {
    const ldOutputSignals = ["ld.out.0"];
    const ghostWidget = makeWidget({ id: "g1", type: "gauge", signal: "ld.out.99", config: { min: 0, max: 100 } });

    const result = validateLayout(makeLayout([ghostWidget]), {
      signalNames: ldOutputSignals,
    });
    expect(result.warnings).toContain(
      "widget 'g1' bound to unknown signal 'ld.out.99'"
    );
  });

  it("validates runtime signal registry matches at save time", () => {
    // ponytail: validates before deployment — catches missing signals early
    const runtimeSignals = [
      "controller.temp", "controller.pressure",
      "controller.flow", "controller.level",
    ];

    const validWidget = makeWidget({ id: "v1", signal: "controller.temp" });
    const result = validateLayout(makeLayout([validWidget]), {
      signalNames: runtimeSignals,
    });
    expect(result.errors.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases for signal validation
// ---------------------------------------------------------------------------

describe("Signal validation edge cases", () => {
  it("does not warn when signalNames option is not provided (no registry)", () => {
    const w = makeWidget({ id: "w1", signal: "any.signal" });
    const result = validateLayout(makeLayout([w]));
    // Without signalNames, no signal warnings are emitted
    expect(
      result.warnings.filter((w) => w.includes("unknown signal")).length
    ).toBe(0);
  });

  it("empty signalNames array triggers warnings for all bound widgets", () => {
    const w = makeWidget({ id: "w1", signal: "my.signal" });
    const result = validateLayout(makeLayout([w]), { signalNames: [] });
    expect(result.warnings).toContain(
      "widget 'w1' bound to unknown signal 'my.signal'"
    );
  });

  it("handles large signalName registries efficiently (200+ signals)", () => {
    const signals = Array.from({ length: 200 }, (_, i) => `sig.ch${i}.val`);
    const w = makeWidget({ id: "w1", signal: "sig.ch99.val" });
    const result = validateLayout(makeLayout([w]), { signalNames: signals });
    expect(
      result.warnings.filter((w) => w.includes("unknown signal")).length
    ).toBe(0);
  });
});
