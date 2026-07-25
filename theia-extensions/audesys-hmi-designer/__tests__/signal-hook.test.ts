/**
 * Signal Hook & Bridge Tests — TC-14 to TC-16 + Panel Signal Bridge
 *
 * Covers:
 *   - TC-14: useTheiaHmiSignal with signal (init null → poll → value)
 *   - TC-15: useTheiaHmiSignal without signal (null, no interval)
 *   - TC-16: useTheiaHmiSignal error handling (error set, clearError resets)
 *   - Signal Bridge: deduplication, cycle-batch, cleanup on unmount
 *
 * ponytail: real timers + waitFor — fake timers with setInterval hooks
 * cause infinite-loop aborts. Test behavior, not implementation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useTheiaHmiSignal,
} from "../src/browser/hooks/useTheiaHmiSignal";

// ---------------------------------------------------------------------------
// Sim mock helpers — each test owns its mock
// ---------------------------------------------------------------------------

interface SimMock {
  readSignal: ReturnType<typeof vi.fn>;
}

/** install a clean window.__audesysSim with a fresh spy */
function installSim(): SimMock {
  const readSignal = vi.fn();
  (window as any).__audesysSim = { readSignal };
  return { readSignal };
}

/** remove __audesysSim completely */
function removeSim(): void {
  delete (window as any).__audesysSim;
}

beforeEach(() => {
  removeSim();
});

afterEach(() => {
  removeSim();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// TC-14: useTheiaHmiSignal with signal name
// ---------------------------------------------------------------------------

describe("TC-14 — useTheiaHmiSignal with signal name", () => {
  it("returns null value initially, then resolves from sim", async () => {
    const sim = installSim();
    sim.readSignal.mockResolvedValue("42.5");

    const { result } = renderHook(() =>
      useTheiaHmiSignal("temp.1.val")
    );

    // Before any async resolution, value is null
    expect(result.current.value).toBeNull();
    expect(result.current.error).toBeNull();

    // Wait for async readSignal to resolve
    await waitFor(() => {
      expect(result.current.value).toBe("42.5");
    });
    expect(sim.readSignal).toHaveBeenCalledWith("temp.1.val");
    expect(result.current.error).toBeNull();
  });

  it("polls continuously, updating value over time", async () => {
    const sim = installSim();
    sim.readSignal
      .mockResolvedValueOnce("10")
      .mockResolvedValueOnce("20")
      .mockResolvedValue("30");

    const { result } = renderHook(() =>
      useTheiaHmiSignal("axis.0.pos")
    );

    // First poll
    await waitFor(() => {
      expect(result.current.value).toBe("10");
    });

    // After another poll (~500ms), value updates
    await waitFor(() => {
      expect(result.current.value).toBe("20");
    }, { timeout: 2000 });

    expect(sim.readSignal.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("updates signal source when signalName changes", async () => {
    const sim = installSim();
    sim.readSignal.mockResolvedValue("ok");

    const { result, rerender } = renderHook(
      ({ signalName }) => useTheiaHmiSignal(signalName),
      { initialProps: { signalName: "first.signal" as string | undefined } }
    );

    await waitFor(() => {
      expect(result.current.value).toBe("ok");
    });
    expect(sim.readSignal).toHaveBeenCalledWith("first.signal");

    // Switch signal
    rerender({ signalName: "second.signal" });

    await waitFor(() => {
      const calls = sim.readSignal.mock.calls;
      const last = calls[calls.length - 1];
      expect(last[0]).toBe("second.signal");
    });
  });

  it("returns null when sim returns null", async () => {
    const sim = installSim();
    sim.readSignal.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useTheiaHmiSignal("null.signal")
    );

    await waitFor(() => {
      // String(null) = "null" — the hook wraps in String()
      expect(result.current.value).toBe("null");
    });
  });
});

// ---------------------------------------------------------------------------
// TC-15: useTheiaHmiSignal without signal name
// ---------------------------------------------------------------------------

describe("TC-15 — useTheiaHmiSignal without signal name", () => {
  it("returns null and does not poll when signalName is undefined", () => {
    const sim = installSim();
    sim.readSignal.mockResolvedValue("should-not-read");

    const { result } = renderHook(() =>
      useTheiaHmiSignal(undefined)
    );

    expect(result.current.value).toBeNull();
    expect(result.current.error).toBeNull();

    // readSignal should never be called
    expect(sim.readSignal).not.toHaveBeenCalled();
  });

  it("returns null when signalName is empty string", () => {
    const sim = installSim();
    sim.readSignal.mockResolvedValue("nope");

    const { result } = renderHook(() =>
      useTheiaHmiSignal("")
    );

    // The hook checks `if (!signalName) return;` — no polling
    expect(result.current.value).toBeNull();
    expect(sim.readSignal).not.toHaveBeenCalled();
  });

  it("clears value when signalName changes to undefined", async () => {
    const sim = installSim();
    sim.readSignal.mockResolvedValue("99");

    const { result, rerender } = renderHook(
      ({ signalName }) => useTheiaHmiSignal(signalName),
      { initialProps: { signalName: "some.signal" as string | undefined } }
    );

    await waitFor(() => {
      expect(result.current.value).toBe("99");
    });

    // Switch to undefined
    rerender({ signalName: undefined });

    // Value should reset immediately
    expect(result.current.value).toBeNull();
    expect(result.current.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TC-16: useTheiaHmiSignal error handling
// ---------------------------------------------------------------------------

describe("TC-16 — useTheiaHmiSignal error handling", () => {
  it("sets error when readSignal throws", async () => {
    const sim = installSim();
    sim.readSignal.mockRejectedValue(new Error("UDS timeout"));

    const { result } = renderHook(() =>
      useTheiaHmiSignal("broken.signal")
    );

    await waitFor(() => {
      expect(result.current.error).toContain("UDS timeout");
    });
    expect(result.current.value).toBeNull();
  });

  it("clearError resets error to null", async () => {
    const sim = installSim();
    sim.readSignal.mockRejectedValue(new Error("connection lost"));

    const { result } = renderHook(() =>
      useTheiaHmiSignal("broken.signal")
    );

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it("recovers from transient error on next poll", async () => {
    const sim = installSim();
    // First call fails, subsequent succeed
    sim.readSignal
      .mockRejectedValueOnce(new Error("transient failure"))
      .mockResolvedValue("recovered");

    const { result } = renderHook(() =>
      useTheiaHmiSignal("recovery.signal")
    );

    // Error appears
    await waitFor(() => {
      expect(result.current.error).toContain("transient failure");
    });

    // Next poll recovers
    await waitFor(() => {
      expect(result.current.value).toBe("recovered");
      expect(result.current.error).toBeNull();
    }, { timeout: 2000 });
  });

  it("returns null value gracefully when __audesysSim is missing", async () => {
    // No sim installed at all — beforeEach removed it
    const { result } = renderHook(() =>
      useTheiaHmiSignal("any.signal")
    );

    // readSignalNative returns null when no sim
    await waitFor(() => {
      // After first tick, resolves to null → String(null) = "null"
      expect(result.current.value).toBe("null");
    });
    expect(result.current.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Panel Signal Bridge Tests
// ---------------------------------------------------------------------------

describe("Signal Bridge — batch and dedup", () => {
  it("latest-value semantics: rapid polls surface latest", async () => {
    const sim = installSim();
    let callCount = 0;
    const values = ["99", "100", "101"];
    sim.readSignal.mockImplementation(() => {
      const val = values[callCount % values.length];
      callCount++;
      return Promise.resolve(val);
    });

    const { result } = renderHook(() =>
      useTheiaHmiSignal("fast.signal")
    );

    // First poll
    await waitFor(() => {
      expect(result.current.value).toBe("99");
    });

    // After more polls, should surface latest values
    await waitFor(() => {
      expect(result.current.value).toBe("100");
    }, { timeout: 2000 });

    await waitFor(() => {
      expect(result.current.value).toBe("101");
    }, { timeout: 2000 });
  });

  it("cleanup cancels interval on unmount", async () => {
    const sim = installSim();
    sim.readSignal.mockResolvedValue("42");

    const { unmount } = renderHook(() =>
      useTheiaHmiSignal("unmount.signal")
    );

    await waitFor(() => {
      expect(sim.readSignal).toHaveBeenCalled();
    });

    const callCountBeforeUnmount = sim.readSignal.mock.calls.length;
    unmount();

    // Wait a bit — no new calls should happen after unmount
    await new Promise((r) => setTimeout(r, 600));

    expect(sim.readSignal.mock.calls.length).toBe(callCountBeforeUnmount);
  });

  it("re-registers interval when signalName changes", async () => {
    const sim = installSim();
    sim.readSignal.mockResolvedValue("ok");

    const { rerender } = renderHook(
      ({ signalName }) => useTheiaHmiSignal(signalName),
      { initialProps: { signalName: "sig.a" as string | undefined } }
    );

    await waitFor(() => {
      expect(sim.readSignal).toHaveBeenCalledWith("sig.a");
    });

    rerender({ signalName: "sig.b" });
    sim.readSignal.mockClear();

    await waitFor(() => {
      // New interval should call with sig.b
      const calls = sim.readSignal.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      if (calls.length > 0) {
        expect(calls[calls.length - 1][0]).toBe("sig.b");
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Signal name format validation
// ---------------------------------------------------------------------------

describe("Signal name format validation", () => {
  it("sets error for invalid signal name format (single segment)", async () => {
    installSim();
    const { result } = renderHook(() =>
      useTheiaHmiSignal("badformat")
    );
    expect(result.current.error).toContain("invalid signal name");
    expect(result.current.error).toContain("component.interface.name");
    expect(result.current.value).toBeNull();
  });

  it("sets error for signal name starting with digit", async () => {
    installSim();
    const { result } = renderHook(() =>
      useTheiaHmiSignal("0axis.pos")
    );
    expect(result.current.error).toContain("invalid signal name");
  });

  it("does not set error for valid two-segment name", async () => {
    installSim();
    const { result } = renderHook(() =>
      useTheiaHmiSignal("axis.pos")
    );
    expect(result.current.error).toBeNull();
  });

  it("does not set error for valid three-segment name", async () => {
    installSim();
    const { result } = renderHook(() =>
      useTheiaHmiSignal("motion.axis.x")
    );
    expect(result.current.error).toBeNull();
  });
});
