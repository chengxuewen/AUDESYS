import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DebugPanel from "../DebugPanel";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("DebugPanel", () => {
  it("renders the Connect button", () => {
    render(<DebugPanel />);

    expect(
      screen.getByRole("button", { name: "Connect" }),
    ).toBeInTheDocument();
  });

  it("shows socket path input with default value", () => {
    render(<DebugPanel />);

    const socketInput = screen.getByPlaceholderText("Socket path");
    expect(socketInput).toBeInTheDocument();
    expect(socketInput).toHaveValue("/tmp/audesys-controller.sock");
  });

  it("shows secret input with default value", () => {
    render(<DebugPanel />);

    const secretInput = screen.getByPlaceholderText("Secret");
    expect(secretInput).toBeInTheDocument();
    expect(secretInput).toHaveValue("audesys-dev-secret");
  });
});
