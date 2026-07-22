// ToolRegistry — Tool registration, grouping, activation lifecycle
// SDD §2: ToolDescriptor, ToolRegistry methods
// Test scenarios: TR-001 through TR-012

import type { ComponentType, LazyExoticComponent } from "react";

// ─── Types ───

export type ShellMode = "edit" | "debug" | "commissioning";

export interface ToolProps {
  toolId: string;
  project: unknown; // ProjectModel — placeholder
  mode: ShellMode;
  commands: unknown; // CommandInvoker — placeholder
  eventBus: unknown; // StudioEventBus — placeholder
}

export interface PanelDescriptor {
  id: string;
  title: string;
  component: ComponentType<unknown>;
  defaultOpen?: boolean;
  sticky?: boolean;
}

export interface ToolbarAction {
  id: string;
  label: string;
  icon: string;
  section: "global" | "mode" | "tool";
  handler: (ctx: unknown) => void;
  shortcut?: string;
  disabled?: (ctx: unknown) => boolean;
  visible?: (ctx: unknown) => boolean;
}

export interface KeyBinding {
  key: string;
  handler: () => void;
}

export interface ToolDescriptor {
  id: string;
  label: string;
  icon: string;
  group: "editor" | "monitor" | "config";
  component:
    | ComponentType<ToolProps>
    | LazyExoticComponent<ComponentType<ToolProps>>;
  panels?: PanelDescriptor[];
  toolbar?: ToolbarAction[];
  keybindings?: KeyBinding[];
  onActivate?(): void | Promise<void>;
  onDeactivate?(): void | Promise<void>;
}

// ─── Errors ───

export class DuplicateToolError extends Error {
  constructor(id: string) {
    super(`Tool with id "${id}" is already registered`);
    this.name = "DuplicateToolError";
  }
}

// ─── ToolRegistry ───

export class ToolRegistry {
  private tools = new Map<string, ToolDescriptor>();
  private activeId: string | null = null;

  /** Register a tool descriptor. Silently skips if already registered. */
  register(descriptor: ToolDescriptor): void {
    if (this.tools.has(descriptor.id)) {
      console.warn(`Tool "${descriptor.id}" already registered, skipping`);
      return;
    }
    this.tools.set(descriptor.id, descriptor);
  }

  /** Get a registered tool by id, or undefined if not found. */
  get(id: string): ToolDescriptor | undefined {
    return this.tools.get(id);
  }

  /** Return all tools grouped by their group field. */
  listByGroup(): Map<string, ToolDescriptor[]> {
    const groups = new Map<string, ToolDescriptor[]>();
    for (const tool of this.tools.values()) {
      const list = groups.get(tool.group);
      if (list) {
        list.push(tool);
      } else {
        groups.set(tool.group, [tool]);
      }
    }
    return groups;
  }

  /** Return tools filtered by mode. Debug mode hides monitor group. */
  listByMode(mode: ShellMode): ToolDescriptor[] {
    const all = Array.from(this.tools.values());
    if (mode === "debug") {
      return all.filter((t) => t.group !== "monitor");
    }
    return all;
  }

  /** Activate a tool. Calls deactivate on current + activate on new. */
  async activate(id: string): Promise<void> {
    const prev = this.activeId ? this.tools.get(this.activeId) : undefined;
    const next = this.tools.get(id);
    if (!next) return;

    // Deactivate previous tool
    if (prev && prev.onDeactivate) {
      try {
        await Promise.resolve(prev.onDeactivate());
      } catch (e) {
        console.error(
          `ToolRegistry: onDeactivate error for "${prev.id}":`,
          e,
        );
      }
    }

    this.activeId = id;

    // Activate new tool
    if (next.onActivate) {
      try {
        await Promise.resolve(next.onActivate());
      } catch (e) {
        console.error(
          `ToolRegistry: onActivate error for "${next.id}":`,
          e,
        );
      }
    }
  }

  /** Get the currently active tool id, or null. */
  getActiveId(): string | null {
    return this.activeId;
  }

  /** Check if two tools belong to the same group. */
  isSameGroup(idA: string, idB: string): boolean {
    const a = this.tools.get(idA);
    const b = this.tools.get(idB);
    if (!a || !b) return false;
    return a.group === b.group;
  }
}
