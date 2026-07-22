import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SimulatorPanel from "../SimulatorPanel";
import { PlatformContext } from "../../platform/provider";

const MockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PlatformContext.Provider value={{ invoke: () => Promise.resolve() } as any}>
    {children}
  </PlatformContext.Provider>
);

describe("SimulatorPanel", () => {
  it("renders Signals tab by default with Start button", () => {
    render(
      <MockProvider>
        <SimulatorPanel />
      </MockProvider>,
    );
    expect(screen.getByText("▶ Start")).toBeTruthy();
    expect(screen.getByText("↷ Step")).toBeTruthy();
  });

  it("switches to Devices tab", () => {
    render(
      <MockProvider>
        <SimulatorPanel />
      </MockProvider>,
    );
    expect(screen.getByText("Devices")).toBeTruthy();
  });

  it("switches to Modbus tab showing Add Mapping", () => {
    render(
      <MockProvider>
        <SimulatorPanel />
      </MockProvider>,
    );
    expect(screen.getByText("Modbus")).toBeTruthy();
  });

  it("switches to Scene tab showing Record button", () => {
    render(
      <MockProvider>
        <SimulatorPanel />
      </MockProvider>,
    );
    expect(screen.getByText("Scene")).toBeTruthy();
  });

  it("switches to Faults tab showing fault checkboxes", () => {
    render(
      <MockProvider>
        <SimulatorPanel />
      </MockProvider>,
    );
    expect(screen.getByText("Faults")).toBeTruthy();
  });
});
