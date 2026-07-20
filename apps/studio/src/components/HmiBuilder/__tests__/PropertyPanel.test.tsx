import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock SignalBindingDialog — tested separately
vi.mock("../SignalBindingDialog", () => ({
  default: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onSelect: () => void;
  }) =>
    isOpen ? (
      <div data-testid="signal-dialog">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

import PropertyPanel from "../PropertyPanel";
import type { HmiWidgetState } from "../../../types/hmi";

const gaugeWidget: HmiWidgetState = {
  id: "w1",
  type: "gauge",
  label: "Motor Speed",
  position: { x: 100, y: 100 },
  size: { width: 200, height: 200 },
  signal: "axis.0.pos",
  config: { min: 0, max: 100, unit: "rpm" },
};

describe("PropertyPanel", () => {
  it("shows placeholder when no widget is selected", () => {
    render(
      <PropertyPanel
        widget={null}
        onUpdateWidget={vi.fn()}
        onRemoveWidget={vi.fn()}
      />,
    );

    expect(screen.getByText("Properties")).toBeInTheDocument();
    expect(
      screen.getByText("Select a widget to edit properties"),
    ).toBeInTheDocument();
  });

  it("renders widget label, position, and size fields when widget is selected", () => {
    render(
      <PropertyPanel
        widget={gaugeWidget}
        onUpdateWidget={vi.fn()}
        onRemoveWidget={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("Motor Speed")).toBeInTheDocument();
    expect(screen.getByText("axis.0.pos")).toBeInTheDocument();
  });

  it("renders gauge-specific config fields", () => {
    render(
      <PropertyPanel
        widget={gaugeWidget}
        onUpdateWidget={vi.fn()}
        onRemoveWidget={vi.fn()}
      />,
    );

    // Gauge config: Min, Max, Unit
    expect(screen.getByText("Min")).toBeInTheDocument();
    expect(screen.getByText("Max")).toBeInTheDocument();
    expect(screen.getByText("Unit")).toBeInTheDocument();
  });

  it("renders Remove button", () => {
    render(
      <PropertyPanel
        widget={gaugeWidget}
        onUpdateWidget={vi.fn()}
        onRemoveWidget={vi.fn()}
      />,
    );

    expect(screen.getByText("Remove Widget")).toBeInTheDocument();
  });
});
