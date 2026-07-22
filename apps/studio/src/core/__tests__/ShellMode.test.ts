// TDD GREEN phase — actual test implementations
// Test scenarios: SM-001 through SM-010
// Implementation target: apps/studio/src/core/ShellMode.ts

import { describe, it, expect, vi } from "vitest";
import {
  ShellModeManager,
  InvalidModeError,
  systemPanels,
  debugModePanels,
  commissioningModePanels,
  globalActions,
  debugModeActions,
} from "../ShellMode";
import { StudioEventBus } from "../StudioEventBus";
import { ToolRegistry, type ToolDescriptor } from "../ToolRegistry";

// ─── Helpers ───

function makeEditorTool(id: string): ToolDescriptor {
  return {
    id,
    label: id,
    icon: "code",
    group: "editor",
    component: () => null,
  };
}

function makeMonitorTool(id: string): ToolDescriptor {
  return {
    id,
    label: id,
    icon: "eye",
    group: "monitor",
    component: () => null,
  };
}

function setup() {
  const eventBus = new StudioEventBus();
  const toolRegistry = new ToolRegistry();
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
  for (const id of editorIds) toolRegistry.register(makeEditorTool(id));
  for (const id of monitorIds) toolRegistry.register(makeMonitorTool(id));

  const shellMode = new ShellModeManager(eventBus, toolRegistry);
  return { eventBus, toolRegistry, shellMode };
}

describe("ShellMode", () => {
  // ─── P0: Must pass before merge ───

  describe("initialization", () => {
    it("SM-001: default mode is 'edit' on initialization", () => {
      const { shellMode } = setup();
      expect(shellMode.mode).toBe("edit");
    });
  });

  describe("mode transitions", () => {
    it("SM-002: setMode('debug') updates mode and emits mode:changed event", () => {
      const { shellMode, eventBus } = setup();
      const handler = vi.fn();
      eventBus.on("mode:changed", handler);

      shellMode.setMode("debug");

      expect(shellMode.mode).toBe("debug");
      expect(handler).toHaveBeenCalledWith({ mode: "debug" });
    });
  });

  describe("NavBar filtering", () => {
    it("SM-003: Debug Mode filters NavBar to show only editor group tools", () => {
      const { shellMode } = setup();
      shellMode.setMode("debug");

      const tools = shellMode.listByMode("debug");
      // 7 editors, 0 monitors
      expect(tools).toHaveLength(7);
      expect(tools.every((t) => t.group !== "monitor")).toBe(true);
    });
  });

  describe("BottomSlot panel sets", () => {
    it("SM-004: Debug Mode adds Breakpoints, Call Stack, and Scope to BottomSlot panels", () => {
      const { shellMode } = setup();
      shellMode.setMode("debug");

      const panels = shellMode.getPanels();
      // systemPanels (3) + debugModePanels (3) = 6
      expect(panels).toHaveLength(systemPanels.length + debugModePanels.length);

      const panelIds = panels.map((p) => p.id);
      expect(panelIds).toContain("errors");
      expect(panelIds).toContain("signal-watch");
      expect(panelIds).toContain("output");
      expect(panelIds).toContain("breakpoints");
      expect(panelIds).toContain("call-stack");
      expect(panelIds).toContain("scope");
    });

    it("SM-005: switching from Debug to Edit restores system panels only", () => {
      const { shellMode } = setup();

      shellMode.setMode("debug");
      expect(shellMode.getPanels()).toHaveLength(
        systemPanels.length + debugModePanels.length,
      );

      shellMode.setMode("edit");
      const panels = shellMode.getPanels();
      expect(panels).toHaveLength(systemPanels.length);
      const panelIds = panels.map((p) => p.id);
      expect(panelIds).not.toContain("breakpoints");
      expect(panelIds).not.toContain("call-stack");
      expect(panelIds).not.toContain("scope");
    });
  });

  describe("Toolbar actions", () => {
    it("SM-006: Debug Mode injects pause, step, and resume into Toolbar actions", () => {
      const { shellMode } = setup();
      shellMode.setMode("debug");

      const actions = shellMode.getToolbarActions();
      // global (3) + debug mode (3) = 6
      expect(actions).toHaveLength(
        globalActions.length + debugModeActions.length,
      );

      const actionIds = actions.map((a) => a.id);
      expect(actionIds).toContain("debug.pause");
      expect(actionIds).toContain("debug.step");
      expect(actionIds).toContain("debug.resume");
      // global actions still present
      expect(actionIds).toContain("project.save");
      expect(actionIds).toContain("compile.run");
    });
  });

  // ─── P1: Complete after implementation ───

  describe("Commissioning Mode", () => {
    it("SM-007: Commissioning Mode adds Signal Watch and Output to BottomSlot panels", () => {
      const { shellMode } = setup();
      shellMode.setMode("commissioning");

      const panels = shellMode.getPanels();
      expect(panels).toHaveLength(
        systemPanels.length + commissioningModePanels.length,
      );

      const panelIds = panels.map((p) => p.id);
      expect(panelIds).toContain("signal-watch");
      expect(panelIds).toContain("output");
    });
  });

  describe("error handling", () => {
    it("SM-008: setMode() with invalid mode throws InvalidModeError", () => {
      const { shellMode } = setup();
      expect(() => shellMode.setMode("invalid" as never)).toThrow(
        InvalidModeError,
      );
    });
  });

  describe("state preservation", () => {
    it("SM-009: active tool is preserved across mode switches", async () => {
      const { shellMode } = setup();

      await shellMode.activate("st-compiler");
      expect(shellMode.getActiveId()).toBe("st-compiler");

      shellMode.setMode("debug");
      expect(shellMode.mode).toBe("debug");
      expect(shellMode.getActiveId()).toBe("st-compiler");
    });

    it("SM-010: direct Debug→Commissioning transition works without passing through Edit", () => {
      const { shellMode } = setup();

      shellMode.setMode("debug");
      expect(shellMode.mode).toBe("debug");

      shellMode.setMode("commissioning");
      expect(shellMode.mode).toBe("commissioning");

      // Panels should be commissioning panels, not debug
      const panels = shellMode.getPanels();
      const panelIds = panels.map((p) => p.id);
      expect(panelIds).not.toContain("breakpoints");
      expect(panelIds).not.toContain("call-stack");
      expect(panelIds).not.toContain("scope");
    });
  });
});
