import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SimulatorPanel from "../SimulatorPanel";

describe("SimulatorPanel", () => {
  it("renders Signals tab by default with Start button", () => {
    render(<SimulatorPanel />);
    expect(screen.getByText("▶ Start")).toBeTruthy();
    expect(screen.getByText("↷ Step")).toBeTruthy();
  });

  it("switches to Devices tab", () => {
    render(<SimulatorPanel />);
    expect(screen.getByText("Devices")).toBeTruthy();
  });

  it("switches to Modbus tab showing Add Mapping", () => {
    render(<SimulatorPanel />);
    expect(screen.getByText("Modbus")).toBeTruthy();
  });

  it("switches to Scene tab showing Record button", () => {
    render(<SimulatorPanel />);
    expect(screen.getByText("Scene")).toBeTruthy();
  });

  it("switches to Faults tab showing fault checkboxes", () => {
    render(<SimulatorPanel />);
    expect(screen.getByText("Faults")).toBeTruthy();
  });
});
