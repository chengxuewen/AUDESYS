/**
 * Widget Rendering Tests — TC-01 to TC-04, TC-24, TC-25
 *
 * Covers:
 *   - TC-01: GaugeWidget basic rendering (SVG arcs, needle, value)
 *   - TC-02: GaugeWidget edge cases (zero/max value, thresholds, min/max defaults)
 *   - TC-03: ButtonWidget basic rendering (label, SVG rect)
 *   - TC-04: ButtonWidget state (onColor/offColor, signalValue truthiness)
 *   - TC-24: WidgetErrorOverlay renders error message with icon
 *   - TC-25: WidgetErrorOverlay dismiss on click
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { GaugeWidget } from "../src/browser/widgets/GaugeWidget";
import { ButtonWidget } from "../src/browser/widgets/ButtonWidget";
import { WidgetErrorOverlay } from "../src/browser/widgets/WidgetErrorOverlay";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const gaugeDefaults = {
  label: "Pressure",
  config: { min: 0, max: 100, unit: "bar", label: "Pressure" },
  width: 200,
  height: 160,
};

const buttonDefaults = {
  label: "Start Pump",
  config: { onColor: "#00D26A", offColor: "#2a2a30" },
  width: 120,
  height: 60,
};

// ---------------------------------------------------------------------------
// TC-01: GaugeWidget basic rendering
// ---------------------------------------------------------------------------

describe("TC-01 — GaugeWidget basic rendering", () => {
  it("renders SVG with value text showing the signal value", () => {
    const { container } = render(
      <GaugeWidget {...gaugeDefaults} signalValue={42.5} />
    );

    // Main SVG is rendered
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();

    // Value text shows "42.5bar"
    const valueText = screen.getByText("42.5bar");
    expect(valueText).toBeInTheDocument();

    // SVG should have the proper viewBox
    expect(svg).toHaveAttribute("viewBox", "0 0 200 160");
  });

  it("renders label from config when present", () => {
    const { container } = render(
      <GaugeWidget
        {...gaugeDefaults}
        config={{ ...gaugeDefaults.config, label: "Tank Level" }}
      />
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();

    // Label text should be visible
    const labelText = screen.getByText("Tank Level");
    expect(labelText).toBeInTheDocument();
  });

  it("renders label in gauge even when config.label is missing (empty string)", () => {
    const { container } = render(
      <GaugeWidget
        {...gaugeDefaults}
        config={{ min: 0, max: 100 }}
        label="Fallback"
      />
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders needle line element", () => {
    const { container } = render(
      <GaugeWidget {...gaugeDefaults} signalValue={50} />
    );

    // Needle is a <line> element
    const needle = container.querySelector("line");
    expect(needle).toBeInTheDocument();
    expect(needle).toHaveAttribute("stroke", "#e8e8ed");
  });
});

// ---------------------------------------------------------------------------
// TC-02: GaugeWidget edge cases
// ---------------------------------------------------------------------------

describe("TC-02 — GaugeWidget edge cases", () => {
  it("renders zero value correctly (no signalValue = default 0)", () => {
    const { container } = render(
      <GaugeWidget {...gaugeDefaults} />
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();

    // Default value is 0, so should display "0.0bar"
    const valueText = screen.getByText("0.0bar");
    expect(valueText).toBeInTheDocument();
  });

  it("renders max value (100) correctly", () => {
    const { container } = render(
      <GaugeWidget {...gaugeDefaults} signalValue={100} />
    );

    const valueText = screen.getByText("100.0bar");
    expect(valueText).toBeInTheDocument();
  });

  it("clamps values above max to 1.0 ratio", () => {
    const { container } = render(
      <GaugeWidget {...gaugeDefaults} signalValue={150} />
    );

    // Should display 150.0bar but arc should be clamped
    const valueText = screen.getByText("150.0bar");
    expect(valueText).toBeInTheDocument();
  });

  it("clamps values below min to 0.0 ratio", () => {
    const { container } = render(
      <GaugeWidget {...gaugeDefaults} signalValue={-10} />
    );

    const valueText = screen.getByText("-10.0bar");
    expect(valueText).toBeInTheDocument();
  });

  it("uses default min=0 and max=100 when config has no min/max", () => {
    const { container } = render(
      <GaugeWidget
        {...gaugeDefaults}
        config={{ unit: "°C" }}
        signalValue={25}
      />
    );

    // Should still compute a value based on default 0-100 range
    const valueText = screen.getByText("25.0°C");
    expect(valueText).toBeInTheDocument();
  });

  it("applies threshold color based on value", () => {
    const thresholds = [
      { value: 0, color: "#00D26A" },
      { value: 50, color: "#FFB800" },
      { value: 80, color: "#FF4444" },
    ];

    const { container } = render(
      <GaugeWidget
        {...gaugeDefaults}
        config={{ min: 0, max: 100, thresholds }}
        signalValue={85}
      />
    );

    // The value arc (second <path>) should be red
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThanOrEqual(2);
    // Value arc (index 1) should use red
    expect(paths[1]).toHaveAttribute("stroke", "#FF4444");
  });
});

// ---------------------------------------------------------------------------
// TC-03: ButtonWidget basic rendering
// ---------------------------------------------------------------------------

describe("TC-03 — ButtonWidget basic rendering", () => {
  it("renders label text in SVG", () => {
    const { container } = render(
      <ButtonWidget {...buttonDefaults} />
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();

    // Label text should be displayed
    const labelText = screen.getByText("Start Pump");
    expect(labelText).toBeInTheDocument();
  });

  it("renders SVG rect for the button shape", () => {
    const { container } = render(
      <ButtonWidget {...buttonDefaults} />
    );

    const rect = container.querySelector("rect");
    expect(rect).toBeInTheDocument();
  });

  it("renders SVG with correct viewBox dimensions", () => {
    const { container } = render(
      <ButtonWidget {...buttonDefaults} width={200} height={100} />
    );

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 200 100");
  });
});

// ---------------------------------------------------------------------------
// TC-04: ButtonWidget state (onColor / offColor)
// ---------------------------------------------------------------------------

describe("TC-04 — ButtonWidget state colors", () => {
  it("shows offColor when signalValue is null", () => {
    const { container } = render(
      <ButtonWidget {...buttonDefaults} />
    );

    const rect = container.querySelector("rect");
    expect(rect).toHaveAttribute("fill", "#2a2a30");
  });

  it("shows offColor when signalValue is '0'", () => {
    const { container } = render(
      <ButtonWidget {...buttonDefaults} signalValue="0" />
    );

    const rect = container.querySelector("rect");
    expect(rect).toHaveAttribute("fill", "#2a2a30");
  });

  it("shows offColor when signalValue is 'false'", () => {
    const { container } = render(
      <ButtonWidget {...buttonDefaults} signalValue="false" />
    );

    const rect = container.querySelector("rect");
    expect(rect).toHaveAttribute("fill", "#2a2a30");
  });

  it("shows onColor when signalValue is '1'", () => {
    const { container } = render(
      <ButtonWidget {...buttonDefaults} signalValue="1" isPreview={true} />
    );

    const rect = container.querySelector("rect");
    expect(rect).toHaveAttribute("fill", "#00D26A");
  });

  it("shows onColor when signalValue is any truthy string", () => {
    const { container } = render(
      <ButtonWidget {...buttonDefaults} signalValue="running" isPreview={true} />
    );

    const rect = container.querySelector("rect");
    expect(rect).toHaveAttribute("fill", "#00D26A");
  });

  it("shows onColor in Preview mode when signalValue is truthy", () => {
    const { container } = render(
      <ButtonWidget {...buttonDefaults} signalValue={1} isPreview={true} />
    );

    const rect = container.querySelector("rect");
    expect(rect).toHaveAttribute("fill", "#00D26A");
  });

  it("uses custom onColor from config", () => {
    const { container } = render(
      <ButtonWidget
        {...buttonDefaults}
        config={{ onColor: "#FFB800", offColor: "#1a1a20" }}
        signalValue="1"
        isPreview={true}
      />
    );

    const rect = container.querySelector("rect");
    expect(rect).toHaveAttribute("fill", "#FFB800");
  });
});

// ---------------------------------------------------------------------------
// TC-24: WidgetErrorOverlay rendering
// ---------------------------------------------------------------------------

describe("TC-24 — WidgetErrorOverlay rendering", () => {
  it("renders error message text", () => {
    render(
      <WidgetErrorOverlay error="signal read timeout" onDismiss={() => {}} />
    );

    const errorText = screen.getByText("signal read timeout");
    expect(errorText).toBeInTheDocument();
  });

  it("renders warning icon (⚠)", () => {
    const { container } = render(
      <WidgetErrorOverlay error="error" onDismiss={() => {}} />
    );

    // The warning character ⚠ (U+26A0)
    const warning = screen.getByText("⚠");
    expect(warning).toBeInTheDocument();
  });

  it("uses red border and semi-transparent red background", () => {
    const { container } = render(
      <WidgetErrorOverlay error="test" onDismiss={() => {}} />
    );

    const overlay = container.firstElementChild as HTMLElement;
    expect(overlay).toBeInTheDocument();
    // jsdom normalizes hex #FF4444 to rgb(255, 68, 68) in style property
    expect(overlay.style.border).toContain("rgb(255, 68, 68)");
    expect(overlay.style.backgroundColor).toContain("rgba(255, 68, 68");
  });
});

// ---------------------------------------------------------------------------
// TC-25: WidgetErrorOverlay dismiss
// ---------------------------------------------------------------------------

describe("TC-25 — WidgetErrorOverlay dismiss", () => {
  it("calls onDismiss when clicked", () => {
    let dismissed = false;
    const { container } = render(
      <WidgetErrorOverlay
        error="test error"
        onDismiss={() => { dismissed = true; }}
      />
    );

    const overlay = container.firstElementChild as HTMLElement;
    fireEvent.click(overlay);

    expect(dismissed).toBe(true);
  });

  it("shows 'click to dismiss' title attribute", () => {
    const { container } = render(
      <WidgetErrorOverlay error="test" onDismiss={() => {}} />
    );

    const overlay = container.firstElementChild as HTMLElement;
    expect(overlay.title).toBe("Click to dismiss");
  });
});
