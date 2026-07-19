import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock Tauri invoke before module imports
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import SignalBindingDialog from "../SignalBindingDialog";

const mockedInvoke = vi.mocked(invoke);

describe("SignalBindingDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset all mock timers set by userEvent
  });

  it("renders nothing when isOpen is false", () => {
    render(
      <SignalBindingDialog isOpen={false} onClose={vi.fn()} onSelect={vi.fn()} />,
    );

    expect(screen.queryByText("Bind Signal")).not.toBeInTheDocument();
  });

  it("renders modal with header, search, and footer when isOpen is true", () => {
    mockedInvoke.mockResolvedValue([]);

    render(
      <SignalBindingDialog isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />,
    );

    expect(screen.getByText("Bind Signal")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search signals...")).toBeInTheDocument();
    expect(screen.getByText("Unbind")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("shows empty state when no signals are available", () => {
    mockedInvoke.mockResolvedValue([]);

    render(
      <SignalBindingDialog isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />,
    );

    expect(
      screen.getByText("No signals available (controller not connected?)"),
    ).toBeInTheDocument();
  });

  it("displays signal names from invoke response", async () => {
    mockedInvoke.mockResolvedValue([
      ["motor.speed", "1200"],
      ["temp.celsius", "45"],
    ]);

    render(
      <SignalBindingDialog isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />,
    );

    expect(await screen.findByText("motor.speed")).toBeInTheDocument();
    expect(screen.getByText("temp.celsius")).toBeInTheDocument();
  });

  it("filters signals by search text", async () => {
    mockedInvoke.mockResolvedValue([
      ["motor.speed", "1200"],
      ["temp.celsius", "45"],
      ["pressure.bar", "3.2"],
    ]);
    const user = userEvent.setup();

    render(
      <SignalBindingDialog isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />,
    );

    // Wait for signals to load
    await screen.findByText("motor.speed");

    const searchInput = screen.getByPlaceholderText("Search signals...");
    await user.type(searchInput, "temp");

    expect(screen.getByText("temp.celsius")).toBeInTheDocument();
    expect(screen.queryByText("motor.speed")).not.toBeInTheDocument();
    expect(screen.queryByText("pressure.bar")).not.toBeInTheDocument();
  });

  it("calls onSelect with signal name when a signal is clicked", async () => {
    mockedInvoke.mockResolvedValue([["motor.speed", "1200"]]);
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <SignalBindingDialog
        isOpen={true}
        onClose={vi.fn()}
        onSelect={onSelect}
      />,
    );

    const signalItem = await screen.findByText("motor.speed");
    await user.click(signalItem);

    expect(onSelect).toHaveBeenCalledWith("motor.speed");
  });

  it("calls onSelect with empty string when Unbind is clicked", async () => {
    mockedInvoke.mockResolvedValue([]);
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <SignalBindingDialog
        isOpen={true}
        onClose={vi.fn()}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByText("Unbind"));
    expect(onSelect).toHaveBeenCalledWith("");
  });

  it("calls onClose when Cancel is clicked", async () => {
    mockedInvoke.mockResolvedValue([]);
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <SignalBindingDialog
        isOpen={true}
        onClose={onClose}
        onSelect={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
