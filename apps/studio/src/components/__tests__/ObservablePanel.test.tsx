import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ObservablePanel from "../ObservablePanel";
import { PlatformContext } from "../../platform/provider";

const MockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PlatformContext.Provider value={{ invoke: () => Promise.resolve() } as any}>
    {children}
  </PlatformContext.Provider>
);

describe("ObservablePanel", () => {
  it("renders Observability header", () => {
    render(
      <MockProvider>
        <ObservablePanel />
      </MockProvider>,
    );
    expect(screen.getByText("Observability")).toBeTruthy();
  });

  it("renders port input with default 9000", () => {
    render(
      <MockProvider>
        <ObservablePanel />
      </MockProvider>,
    );
    const input = screen.getByPlaceholderText("port") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("9000");
  });

  it("renders Start button", () => {
    render(
      <MockProvider>
        <ObservablePanel />
      </MockProvider>,
    );
    expect(screen.getByText("Start")).toBeTruthy();
  });
});
