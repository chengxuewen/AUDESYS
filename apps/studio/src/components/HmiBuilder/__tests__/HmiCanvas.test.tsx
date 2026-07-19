import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock react-rnd (complex DOM interaction, not needed for unit tests)
vi.mock("react-rnd", () => ({
  Rnd: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-rnd">{children}</div>
  ),
}));

// Mock widget components (tested separately)
vi.mock("../../widgets/GaugeWidget", () => ({
  default: ({ label }: { label: string }) => <div>{label}</div>,
}));
vi.mock("../../widgets/ButtonWidget", () => ({
  default: ({ label }: { label: string }) => <div>{label}</div>,
}));
vi.mock("../../widgets/TextWidget", () => ({
  default: ({ label }: { label: string }) => <div>{label}</div>,
}));
vi.mock("../../widgets/IndicatorWidget", () => ({
  default: ({ label }: { label: string }) => <div>{label}</div>,
}));
vi.mock("../../widgets/TrendWidget", () => ({
  default: ({ label }: { label: string }) => <div>{label}</div>,
}));
vi.mock("../../widgets/TankWidget", () => ({
  default: ({ label }: { label: string }) => <div>{label}</div>,
}));
vi.mock("../../widgets/DisplayWidget", () => ({
  default: ({ label }: { label: string }) => <div>{label}</div>,
}));

import HmiCanvas from "../HmiCanvas";
import type { HmiWidgetState } from "../../../types/hmi";

const mockWidget: HmiWidgetState = {
  id: "w1",
  type: "gauge",
  label: "Motor Speed",
  position: { x: 100, y: 100 },
  size: { width: 200, height: 200 },
  config: {},
};

describe("HmiCanvas", () => {
  it("renders WidgetPalette and HmiToolbar", () => {
    render(
      <HmiCanvas
        canvasWidth={1200}
        canvasHeight={800}
        widgets={[]}
        selectedWidgetId={null}
        onSelectWidget={vi.fn()}
        onUpdateWidget={vi.fn()}
        onRemoveWidget={vi.fn()}
        onAddWidget={vi.fn()}
        onSave={vi.fn()}
        onLoad={vi.fn()}
      />,
    );

    expect(screen.getByText("Widgets")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("shows empty state when no widgets", () => {
    render(
      <HmiCanvas
        canvasWidth={1200}
        canvasHeight={800}
        widgets={[]}
        selectedWidgetId={null}
        onSelectWidget={vi.fn()}
        onUpdateWidget={vi.fn()}
        onRemoveWidget={vi.fn()}
        onAddWidget={vi.fn()}
        onSave={vi.fn()}
        onLoad={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        "Add widgets from the palette to start designing your HMI panel.",
      ),
    ).toBeInTheDocument();
  });

  it("renders widget with correct label", () => {
    render(
      <HmiCanvas
        canvasWidth={1200}
        canvasHeight={800}
        widgets={[mockWidget]}
        selectedWidgetId={null}
        onSelectWidget={vi.fn()}
        onUpdateWidget={vi.fn()}
        onRemoveWidget={vi.fn()}
        onAddWidget={vi.fn()}
        onSave={vi.fn()}
        onLoad={vi.fn()}
      />,
    );

    expect(screen.getByText("Motor Speed")).toBeInTheDocument();
  });
});
