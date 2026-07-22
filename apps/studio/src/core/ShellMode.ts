// ShellMode — Edit/Debug/Commissioning mode management
// SDD §9: ShellMode type, mode state, transition rules, panels, toolbar
// Test scenarios: SM-001 through SM-010

import React from "react";
import type { PanelDescriptor, ToolbarAction, ShellMode } from "./ToolRegistry";
import type { ToolRegistry } from "./ToolRegistry";

export type { ShellMode };

// ─── Errors ───

export class InvalidModeError extends Error {
  constructor(mode: string) {
    super(`Invalid mode: "${mode}". Valid modes: edit, debug, commissioning`);
    this.name = "InvalidModeError";
  }
}

// ─── System panels (always present) ───

// ponytail: placeholder component — renders panel title until real panels are ported
function PlaceholderPanel({ title }: { title: string }) {
  return React.createElement("div", {
    style: { padding: "12px", fontSize: 12, color: "var(--color-text-tertiary)" },
  }, title);
}

export const systemPanels: PanelDescriptor[] = [
  { id: "errors", title: "Errors", component: () => React.createElement(PlaceholderPanel, { title: "Errors" }), sticky: true },
  { id: "signal-watch", title: "Signal Watch", component: () => React.createElement(PlaceholderPanel, { title: "Signal Watch" }), sticky: true },
  { id: "output", title: "Output", component: () => React.createElement(PlaceholderPanel, { title: "Output" }), sticky: true },
];

// ─── Debug mode panels ───

export const debugModePanels: PanelDescriptor[] = [
  { id: "breakpoints", title: "Breakpoints", component: () => React.createElement(PlaceholderPanel, { title: "Breakpoints" }) },
  { id: "call-stack", title: "Call Stack", component: () => React.createElement(PlaceholderPanel, { title: "Call Stack" }) },
  { id: "scope", title: "Scope", component: () => React.createElement(PlaceholderPanel, { title: "Scope" }) },
];

// ─── Commissioning mode panels ───

export const commissioningModePanels: PanelDescriptor[] = [
  { id: "signal-watch", title: "Signal Watch", component: () => React.createElement(PlaceholderPanel, { title: "Signal Watch" }) },
  { id: "output", title: "Output", component: () => React.createElement(PlaceholderPanel, { title: "Output" }) },
];

// ─── Global toolbar actions ───

export const globalActions: ToolbarAction[] = [
  { id: "project.save", section: "global", icon: "save", label: "Save", handler: () => {} },
  { id: "project.open", section: "global", icon: "folder-open", label: "Open", handler: () => {} },
  { id: "compile.run", section: "global", icon: "play", label: "Compile", handler: () => {} },
];

// ─── Debug mode toolbar actions ───

export const debugModeActions: ToolbarAction[] = [
  { id: "debug.pause", section: "mode", icon: "pause", label: "Pause", handler: () => {} },
  { id: "debug.step", section: "mode", icon: "arrow-right", label: "Step", handler: () => {} },
  { id: "debug.resume", section: "mode", icon: "play", label: "Resume", handler: () => {} },
];

// ─── Commissioning mode toolbar actions ───

export const commissioningModeActions: ToolbarAction[] = [
  { id: "deploy.run", section: "mode", icon: "rocket", label: "Deploy", handler: () => {} },
  { id: "snapshot.take", section: "mode", icon: "camera", label: "Snapshot", handler: () => {} },
];

const VALID_MODES: Set<string> = new Set(["edit", "debug", "commissioning"]);

// ─── ShellModeManager ───

export class ShellModeManager {
  private _mode: ShellMode = "edit";
  private eventBus: StudioEventBus;
  private toolRegistry: ToolRegistry;

  constructor(eventBus: StudioEventBus, toolRegistry: ToolRegistry) {
    this.eventBus = eventBus;
    this.toolRegistry = toolRegistry;
  }

  /** Current shell mode. */
  get mode(): ShellMode {
    return this._mode;
  }

  /** Transition to a new mode. Validates, emits mode:changed. */
  setMode(newMode: ShellMode): void {
    if (!VALID_MODES.has(newMode)) {
      throw new InvalidModeError(newMode);
    }
    this._mode = newMode;
    this.eventBus.emit("mode:changed", { mode: newMode });
  }

  /** Get the panel set based on current mode. */
  getPanels(): PanelDescriptor[] {
    const panels = [...systemPanels];
    if (this._mode === "debug") {
      panels.push(...debugModePanels);
    } else if (this._mode === "commissioning") {
      panels.push(...commissioningModePanels);
    }
    return panels;
  }

  /** Get toolbar actions based on current mode. */
  getToolbarActions(): ToolbarAction[] {
    // global + mode-specific
    const actions: ToolbarAction[] = [...globalActions];
    if (this._mode === "debug") {
      actions.push(...debugModeActions);
    } else if (this._mode === "commissioning") {
      actions.push(...commissioningModeActions);
    }
    return actions;
  }

  /** List tools filtered by mode (delegates to ToolRegistry). */
  listByMode(mode?: ShellMode) {
    return this.toolRegistry.listByMode(mode ?? this._mode);
  }

  /** Get active tool id. */
  getActiveId(): string | null {
    return this.toolRegistry.getActiveId();
  }

  /** Activate a tool. */
  async activate(id: string): Promise<void> {
    return this.toolRegistry.activate(id);
  }
}
