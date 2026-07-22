// TDD GREEN phase — actual test implementations
// Test scenarios: TR-001 through TR-012
// Implementation target: apps/studio/src/core/ToolRegistry.ts

import { describe, it, expect, vi } from "vitest";
import {
  ToolRegistry,
  DuplicateToolError,
  type ToolDescriptor,
} from "../ToolRegistry";

// ─── Helpers ───

function makeDescriptor(
  overrides: Partial<ToolDescriptor> = {},
): ToolDescriptor {
  return {
    id: "st-compiler",
    label: "ST Compiler",
    icon: "code",
    group: "editor",
    component: () => null,
    ...overrides,
  };
}

function makeEditorTool(id: string): ToolDescriptor {
  return makeDescriptor({ id, label: id, group: "editor" });
}

function makeMonitorTool(id: string): ToolDescriptor {
  return makeDescriptor({ id, label: id, group: "monitor" });
}

function registerAllTools(registry: ToolRegistry): void {
  const editorIds = [
    "st-compiler",
    "il-compiler",
    "ld-compiler",
    "fbd-compiler",
    "sfc-compiler",
    "gcode-editor",
    "hmi-designer",
  ];
  const monitorIds = ["signal-browser", "simulator"];
  for (const id of editorIds) registry.register(makeEditorTool(id));
  for (const id of monitorIds) registry.register(makeMonitorTool(id));
}

describe("ToolRegistry", () => {
  // ─── P0: Must pass before merge ───

  describe("registration", () => {
    it("TR-001: get() returns registered ToolDescriptor after register()", () => {
      const registry = new ToolRegistry();
      const desc = makeDescriptor({ id: "st-compiler" });
      registry.register(desc);
      expect(registry.get("st-compiler")).toBe(desc);
    });

    it("TR-002: register() with duplicate id skips silently", () => {
      const original = console.warn;
      let warned = false;
      console.warn = (msg: string) => { if (msg.includes('already registered')) warned = true; };
      const registry = new ToolRegistry();
      registry.register(makeDescriptor({ id: "st-compiler" }));
      expect(() =>
        registry.register(makeDescriptor({ id: "st-compiler" })),
      ).not.toThrow();
      expect(warned).toBe(true);
      expect(registry.get("st-compiler")).toBeDefined();
      console.warn = original;
    });

    it("TR-003: get() returns undefined for unregistered id", () => {
      const registry = new ToolRegistry();
      expect(registry.get("nonexistent")).toBeUndefined();
    });
  });

  describe("grouping", () => {
    it("TR-004: listByGroup() returns Map keyed by group with all registered tools", () => {
      const registry = new ToolRegistry();
      registerAllTools(registry);

      const groups = registry.listByGroup();
      expect(groups.get("editor")).toHaveLength(7);
      expect(groups.get("monitor")).toHaveLength(2);
    });

    it("TR-005: listByMode('debug') filters out monitor group tools", () => {
      const registry = new ToolRegistry();
      registerAllTools(registry);

      const tools = registry.listByMode("debug");
      // Only editor group tools (7), no monitor tools
      expect(tools).toHaveLength(7);
      expect(tools.every((t) => t.group === "editor")).toBe(true);
      expect(tools.some((t) => t.group === "monitor")).toBe(false);
    });

    it("TR-006: listByMode('edit') returns all tools including monitor group", () => {
      const registry = new ToolRegistry();
      registerAllTools(registry);

      const tools = registry.listByMode("edit");
      expect(tools).toHaveLength(9);
    });
  });

  describe("activation lifecycle", () => {
    it("TR-007: activate() calls the tool's onActivate hook", async () => {
      const registry = new ToolRegistry();
      const onActivate = vi.fn();
      registry.register(makeDescriptor({ id: "st-compiler", onActivate }));

      await registry.activate("st-compiler");
      expect(onActivate).toHaveBeenCalledOnce();
    });

    it("TR-008: switching tool calls old onDeactivate then new onActivate", async () => {
      const registry = new ToolRegistry();
      const onDeactivateSt = vi.fn();
      const onActivateHmi = vi.fn();

      registry.register(
        makeDescriptor({ id: "st-compiler", onDeactivate: onDeactivateSt }),
      );
      registry.register(
        makeDescriptor({ id: "hmi-designer", onActivate: onActivateHmi }),
      );

      // Activate ST first
      await registry.activate("st-compiler");
      // Then switch to HMI
      await registry.activate("hmi-designer");

      // onDeactivate for ST called first, then onActivate for HMI
      expect(onDeactivateSt).toHaveBeenCalledOnce();
      expect(onActivateHmi).toHaveBeenCalledOnce();
      // Verify order
      expect(onDeactivateSt.mock.invocationCallOrder[0]).toBeLessThan(
        onActivateHmi.mock.invocationCallOrder[0],
      );
    });
  });

  // ─── P1: Complete after implementation ───

  describe("keepAlive behavior", () => {
    it("TR-009: same-group switch updates activeId but preserves old Tool DOM (display:none)", async () => {
      const registry = new ToolRegistry();
      registry.register(makeEditorTool("st-compiler"));
      registry.register(makeEditorTool("hmi-designer"));

      await registry.activate("st-compiler");
      expect(registry.getActiveId()).toBe("st-compiler");

      await registry.activate("hmi-designer");
      // Active id updated
      expect(registry.getActiveId()).toBe("hmi-designer");
      // Same group — isSameGroup should be true
      expect(registry.isSameGroup("st-compiler", "hmi-designer")).toBe(true);
    });

    it("TR-010: cross-group switch unmounts old Tool and mounts new one", async () => {
      const registry = new ToolRegistry();
      registry.register(makeEditorTool("st-compiler"));
      registry.register(makeMonitorTool("signal-browser"));

      await registry.activate("st-compiler");
      await registry.activate("signal-browser");

      expect(registry.getActiveId()).toBe("signal-browser");
      // Cross group — isSameGroup should be false
      expect(
        registry.isSameGroup("st-compiler", "signal-browser"),
      ).toBe(false);
    });
  });

  describe("error handling", () => {
    it("TR-011: onActivate exception is caught and does not block tool switch", async () => {
      const registry = new ToolRegistry();
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      registry.register(
        makeDescriptor({
          id: "st-compiler",
          onActivate: () => {
            throw new Error("activate failed");
          },
        }),
      );
      registry.register(makeEditorTool("hmi-designer"));

      // Should not throw — error is caught
      await registry.activate("st-compiler");
      expect(registry.getActiveId()).toBe("st-compiler");
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // ─── P2: Future iteration ───

  describe("performance", () => {
    it("TR-012: get() completes in <1ms after 50 registrations and 100 queries", () => {
      const registry = new ToolRegistry();
      // Register 50 tools
      for (let i = 0; i < 50; i++) {
        registry.register(makeEditorTool(`tool-${i}`));
      }

      // Warm up
      registry.get("tool-25");

      // 100 queries
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        registry.get("tool-25");
      }
      const elapsed = performance.now() - start;

      // Average should be < 1ms total for 100 queries
      expect(elapsed).toBeLessThan(1);
    });
  });
});
