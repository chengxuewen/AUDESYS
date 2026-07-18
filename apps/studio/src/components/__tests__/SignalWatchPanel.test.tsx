import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignalWatchPanel from "../SignalWatchPanel";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

const mockedInvoke = vi.mocked(invoke);

describe("SignalWatchPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  it("renders idle state with Start button", () => {
    render(<SignalWatchPanel />);

    expect(screen.getByText("Signal Monitor")).toBeInTheDocument();
    expect(screen.getByText("○ Idle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
  });

  it("does not show Stop button in idle state", () => {
    render(<SignalWatchPanel />);

    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
  });

  it("shows 'Live' status after clicking Start", async () => {
    mockedInvoke.mockResolvedValue([]);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<SignalWatchPanel />);
    await user.click(screen.getByRole("button", { name: "Start" }));

    expect(screen.getByText("● Live (0)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
  });

  it("shows signals table after invoke returns data", async () => {
    mockedInvoke.mockResolvedValue([
      ["motor.speed", "1200"],
      ["temp.celsius", "45"],
    ]);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<SignalWatchPanel />);
    await user.click(screen.getByRole("button", { name: "Start" }));

    // The startPolling sets an interval at 500ms — advance to trigger the first poll
    await act(() => vi.advanceTimersByTimeAsync(500));

    expect(screen.getByText("motor.speed")).toBeInTheDocument();
    expect(screen.getByText("1200")).toBeInTheDocument();
    expect(screen.getByText("temp.celsius")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
  });

  it("shows empty state when polling but no signals", async () => {
    mockedInvoke.mockResolvedValue([]);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<SignalWatchPanel />);
    await user.click(screen.getByRole("button", { name: "Start" }));

    await act(() => vi.advanceTimersByTimeAsync(500));

    expect(screen.getByText(/No signals yet/)).toBeInTheDocument();
  });

  it("stops polling when Stop is clicked", async () => {
    mockedInvoke.mockResolvedValue([]);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<SignalWatchPanel />);
    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("button", { name: "Stop" }));

    expect(screen.getByText("○ Idle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
  });
});
