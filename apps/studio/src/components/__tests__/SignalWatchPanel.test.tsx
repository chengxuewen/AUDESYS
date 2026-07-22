import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignalWatchPanel from "../SignalWatchPanel";
import { PlatformContext } from "../../platform/provider";

const mockedInvoke = vi.fn();

const MockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PlatformContext.Provider value={{ invoke: mockedInvoke } as any}>
    {children}
  </PlatformContext.Provider>
);

describe("SignalWatchPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders idle state with Start button", () => {
    render(
      <MockProvider>
        <SignalWatchPanel />
      </MockProvider>,
    );

    expect(screen.getByText("Signal Monitor")).toBeInTheDocument();
    expect(screen.getByText("○ Idle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
  });

  it("does not show Stop button in idle state", () => {
    render(
      <MockProvider>
        <SignalWatchPanel />
      </MockProvider>,
    );

    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
  });

  it("shows 'Live' status after clicking Start", async () => {
    mockedInvoke.mockResolvedValue([]);
    const user = userEvent.setup();

    render(
      <MockProvider>
        <SignalWatchPanel />
      </MockProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Start" }));

    expect(screen.getByText("● Live (0)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
  });

  it("shows signals table after invoke returns data", async () => {
    mockedInvoke.mockResolvedValue([
      ["motor.speed", "1200"],
      ["temp.celsius", "45"],
    ]);
    const user = userEvent.setup();

    render(
      <MockProvider>
        <SignalWatchPanel />
      </MockProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Start" }));

    // Wait for the async poll to resolve
    await vi.waitFor(() => {
      expect(screen.getByText("motor.speed")).toBeInTheDocument();
    }, { timeout: 2000 });
    expect(screen.getByText("1200")).toBeInTheDocument();
    expect(screen.getByText("temp.celsius")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
  });

  it("shows empty state when polling but no signals", async () => {
    mockedInvoke.mockResolvedValue([]);
    const user = userEvent.setup();

    render(
      <MockProvider>
        <SignalWatchPanel />
      </MockProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Start" }));

    await vi.waitFor(() => {
      expect(screen.getByText(/No signals yet/)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it("stops polling when Stop is clicked", async () => {
    mockedInvoke.mockResolvedValue([]);
    const user = userEvent.setup();

    render(
      <MockProvider>
        <SignalWatchPanel />
      </MockProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("button", { name: "Stop" }));

    expect(screen.getByText("○ Idle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
  });
});
