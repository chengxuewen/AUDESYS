import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DebugPanel from "../DebugPanel";
import { PlatformContext } from "../../platform/provider";

const mockedInvoke = vi.fn();

const MockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PlatformContext.Provider value={{ invoke: mockedInvoke } as any}>
    {children}
  </PlatformContext.Provider>
);

describe("DebugPanel", () => {
  it("renders the Connect button", () => {
    render(
      <MockProvider>
        <DebugPanel />
      </MockProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Connect" }),
    ).toBeInTheDocument();
  });

  it("shows socket path input with default value", () => {
    render(
      <MockProvider>
        <DebugPanel />
      </MockProvider>,
    );

    const socketInput = screen.getByPlaceholderText("Socket path");
    expect(socketInput).toBeInTheDocument();
    expect(socketInput).toHaveValue("/tmp/audesys-controller.sock");
  });

  it("shows secret input with default value", () => {
    render(
      <MockProvider>
        <DebugPanel />
      </MockProvider>,
    );

    const secretInput = screen.getByPlaceholderText("Secret");
    expect(secretInput).toBeInTheDocument();
    expect(secretInput).toHaveValue("audesys-dev-secret");
  });
});
