// TDD GREEN phase — actual test implementations
// Test scenarios: EB-001 through EB-015
// Implementation target: apps/studio/src/core/StudioEventBus.ts

import { describe, it, expect, vi } from "vitest";
import {
  StudioEventBus,
  DuplicateResponderError,
  NoResponderError,
  TimeoutError,
} from "../StudioEventBus";

describe("StudioEventBus", () => {
  // ─── P0: Must pass before merge ───

  describe("pub/sub basics", () => {
    it("EB-001: emit() triggers handler registered via on() with correct data", () => {
      const bus = new StudioEventBus();
      const handler = vi.fn();
      bus.on("test", handler);
      bus.emit("test", { value: 42 });
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({ value: 42 });
    });

    it("EB-002: unsubscribe returned by on() removes the handler", () => {
      const bus = new StudioEventBus();
      const handler = vi.fn();
      const unsub = bus.on("test", handler);
      unsub();
      bus.emit("test", {});
      expect(handler).not.toHaveBeenCalled();
    });

    it("EB-003: emit() calls all handlers registered for the same event", () => {
      const bus = new StudioEventBus();
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      bus.on("test", fn1);
      bus.on("test", fn2);
      bus.emit("test", "data");
      expect(fn1).toHaveBeenCalledWith("data");
      expect(fn2).toHaveBeenCalledWith("data");
    });

    it("EB-004: handler exception does not block other handlers on same event", () => {
      const bus = new StudioEventBus();
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const fn2 = vi.fn();
      bus.on("test", () => {
        throw new Error("boom");
      });
      bus.on("test", fn2);

      // Should not throw
      bus.emit("test", "data");
      expect(fn2).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("tool-scoped cleanup", () => {
    it("EB-005: cleanupTool() removes all subscriptions for the given toolId", () => {
      const bus = new StudioEventBus();
      const handler = vi.fn();
      bus.on("e1", handler, { toolId: "t1" });
      bus.on("e2", handler, { toolId: "t1" });

      bus.cleanupTool("t1");

      bus.emit("e1", {});
      bus.emit("e2", {});
      expect(handler).not.toHaveBeenCalled();
    });

    it("EB-006: cleanupTool() does not affect subscriptions of other toolIds", () => {
      const bus = new StudioEventBus();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.on("e1", handler1, { toolId: "t1" });
      bus.on("e1", handler2, { toolId: "t2" });

      bus.cleanupTool("t1");

      // t1 handler removed, t2 handler still active
      bus.emit("e1", {});
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledOnce();
    });
  });

  describe("request/response", () => {
    it("EB-007: respond() with duplicate event name throws DuplicateResponderError", () => {
      const bus = new StudioEventBus();
      bus.respond("compile", () => "ok");
      expect(() => bus.respond("compile", () => "fail")).toThrow(
        DuplicateResponderError,
      );
    });

    it("EB-008: request() resolves with the responder handler's return value", async () => {
      const bus = new StudioEventBus();
      bus.respond("compile", async () => "ok");
      const result = await bus.request("compile");
      expect(result).toBe("ok");
    });

    it("EB-009: request() with no responder throws NoResponderError", async () => {
      const bus = new StudioEventBus();
      await expect(bus.request("nonexistent")).rejects.toThrow(
        NoResponderError,
      );
    });
  });

  // ─── P1: Complete after implementation ───

  describe("responder introspection", () => {
    it("EB-010: hasResponder() returns true for registered responder", () => {
      const bus = new StudioEventBus();
      bus.respond("compile", () => {});
      expect(bus.hasResponder("compile")).toBe(true);
    });

    it("EB-011: hasResponder() returns false for unregistered event", () => {
      const bus = new StudioEventBus();
      expect(bus.hasResponder("nonexistent")).toBe(false);
    });
  });

  describe("error handling", () => {
    it("EB-012: request() throws TimeoutError when responder does not resolve in time", async () => {
      const bus = new StudioEventBus();
      // Register a responder that never resolves
      bus.respond("slow", () => new Promise(() => {}));

      await expect(bus.request("slow", undefined, 100)).rejects.toThrow(
        TimeoutError,
      );
    });
  });

  describe("boundary conditions", () => {
    it("EB-013: handler registered without toolId is unaffected by cleanupTool()", () => {
      const bus = new StudioEventBus();
      const handler = vi.fn();
      bus.on("e", handler); // No toolId
      bus.cleanupTool("t1");
      bus.emit("e", "data");
      expect(handler).toHaveBeenCalledOnce();
    });

    it("EB-014: emit() with no handlers succeeds silently", () => {
      const bus = new StudioEventBus();
      // Should not throw
      expect(() => bus.emit("unregistered", {})).not.toThrow();
    });
  });

  // ─── P2: Future iteration ───

  describe("performance", () => {
    it("EB-015: emit() completes in <5ms with 100 handlers subscribed", () => {
      const bus = new StudioEventBus();
      for (let i = 0; i < 100; i++) {
        bus.on("perf", () => {});
      }

      const start = performance.now();
      bus.emit("perf", {});
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(5);
    });
  });
});
