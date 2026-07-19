import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WidgetPalette from "../WidgetPalette";

describe("WidgetPalette", () => {
  it("renders all 7 widget presets", () => {
    render(<WidgetPalette onAddWidget={vi.fn()} />);

    expect(screen.getByText("Gauge")).toBeInTheDocument();
    expect(screen.getByText("Button")).toBeInTheDocument();
    expect(screen.getByText("Text")).toBeInTheDocument();
    expect(screen.getByText("Indicator")).toBeInTheDocument();
    expect(screen.getByText("Trend")).toBeInTheDocument();
    expect(screen.getByText("Tank")).toBeInTheDocument();
    expect(screen.getByText("Display")).toBeInTheDocument();
  });

  it("renders widget descriptions", () => {
    render(<WidgetPalette onAddWidget={vi.fn()} />);

    expect(screen.getByText("Circular gauge with thresholds")).toBeInTheDocument();
    expect(screen.getByText("Toggle or momentary command")).toBeInTheDocument();
    expect(screen.getByText("Static or dynamic text label")).toBeInTheDocument();
  });

  it("calls onAddWidget with type and label when a widget is clicked", async () => {
    const onAddWidget = vi.fn();
    const user = userEvent.setup();
    render(<WidgetPalette onAddWidget={onAddWidget} />);

    await user.click(screen.getByText("Gauge"));

    expect(onAddWidget).toHaveBeenCalledTimes(1);
    expect(onAddWidget).toHaveBeenCalledWith("gauge", "Gauge");
  });

  it("renders header with matching style", () => {
    render(<WidgetPalette onAddWidget={vi.fn()} />);

    const header = screen.getByText("Widgets");
    expect(header).toBeInTheDocument();
    expect(header).toHaveStyle({ color: "#FFB800", fontSize: "13px" });
  });
});
