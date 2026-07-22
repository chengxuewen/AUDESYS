// Shell — orchestrates NavBar + ModeSelector + Toolbar + EditorSlot + BottomSlot + InspectorSlot
// SDD §1: full layout; ToolRegistry + EventBus + ShellMode manager
import { useState, useMemo, useCallback } from "react";
import { ToolRegistry } from "../core/ToolRegistry";
import { StudioEventBus } from "../core/StudioEventBus";
import { ShellModeManager } from "../core/ShellMode";
import type { ToolDescriptor, ShellMode, ToolProps } from "../core/ToolRegistry";
import NavBar from "./NavBar";
import ModeSelector from "./ModeSelector";
import Toolbar from "./Toolbar";
import EditorSlot from "./EditorSlot";
import BottomSlot from "./BottomSlot";
import InspectorSlot from "./InspectorSlot";

// Tool descriptors — import all 9 built-in tools
import { descriptor as stCompiler } from "../tools/StCompilerTool";
import { descriptor as ilCompiler } from "../tools/IlCompilerTool";
import { descriptor as ldCompiler } from "../tools/LdCompilerTool";
import { descriptor as fbdCompiler } from "../tools/FbdCompilerTool";
import { descriptor as sfcCompiler } from "../tools/SfcCompilerTool";
import { descriptor as gcodeEditor } from "../tools/GCodeEditorTool";
import { descriptor as hmiDesigner } from "../tools/HmiDesignerTool";
import { descriptor as signalBrowser } from "../tools/SignalBrowserTool";
import { descriptor as simulator } from "../tools/SimulatorTool";

const rawDescriptors = [
  stCompiler, ilCompiler, ldCompiler, fbdCompiler, sfcCompiler,
  gcodeEditor, hmiDesigner, signalBrowser, simulator,
];

/**
 * Assign group and ensure label.
 * ponytail: Manual mapping — tool descriptors lack `group` and use `name` instead of `label`.
 * Fix tools/types.ts when ready.
 */
const GROUP_MAP: Record<string, ToolDescriptor["group"]> = {
  "audesys.st-compiler": "editor",
  "audesys.il-compiler": "editor",
  "audesys.ld-compiler": "editor",
  "audesys.fbd-compiler": "editor",
  "audesys.sfc-compiler": "editor",
  "audesys.gcode-editor": "editor",
  "audesys.hmi-designer": "config",
  "audesys.signal-browser": "monitor",
  "audesys.simulator": "monitor",
};

/** Augment raw descriptors with required ToolDescriptor fields */
function makeDescriptor(raw: Record<string, unknown>): ToolDescriptor {
  const id = raw.id as string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component = (raw as any).component;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const name = (raw as any).name ?? id;
  return {
    id,
    label: name,
    icon: (raw.icon as string) ?? "code",
    group: GROUP_MAP[id] ?? "editor",
    component,
  };
}

export default function Shell() {
  // ── Singletons (lazy init via useMemo) ──
  const eventBus = useMemo(() => new StudioEventBus(), []);
  const toolRegistry = useMemo(() => new ToolRegistry(), []);
  const shellMode = useMemo(() => new ShellModeManager(eventBus, toolRegistry), [eventBus, toolRegistry]);

  // Register tools once
  useMemo(() => {
    for (const raw of rawDescriptors) {
      toolRegistry.register(makeDescriptor(raw as unknown as Record<string, unknown>));
    }
  }, [toolRegistry]);

  // ── State ──
  const [mode, setMode] = useState<ShellMode>("edit");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [prevToolId, setPrevToolId] = useState<string | null>(null);

  const activeTool = activeId ? toolRegistry.get(activeId) : undefined;

  const handleModeChange = useCallback((newMode: ShellMode) => {
    shellMode.setMode(newMode);
    setMode(newMode);
  }, [shellMode]);

  const handleToolActivate = useCallback(async (id: string) => {
    setPrevToolId(activeId);
    await toolRegistry.activate(id);
    setActiveId(id);
    eventBus.emit("tool:activated", { toolId: id });
  }, [activeId, toolRegistry, eventBus]);

  // ── Build ToolProps for active tool ──
  const toolProps: ToolProps = useMemo(() => ({
    toolId: activeId ?? "",
    project: null,
    mode,
    commands: null,
    eventBus,
  }), [activeId, mode, eventBus]);

  // ── Toolbar actions (shell + tool) ──
  const shellActions = shellMode.getToolbarActions();
  const toolActions = activeTool?.toolbar;

  // ── Bottom panels (shell + tool) ──
  const shellPanels = shellMode.getPanels();
  const toolPanels = activeTool?.panels;

  // ── Inspector visibility (HMI Designer only) ──
  const showInspector = activeId === "audesys.hmi-designer";

  // ── Filtered tools for NavBar ──
  const navbarTools = shellMode.listByMode(mode);

  return (
    <div className="app-root">
      {/* Mode selector */}
      <ModeSelector current={mode} onChange={handleModeChange} />

      {/* Toolbar */}
      <Toolbar
        shellActions={shellActions}
        toolActions={toolActions}
        status={activeTool ? `${activeTool.label}` : undefined}
      />

      {/* Main area: NavBar | ProjectTree | EditorSlot | InspectorSlot */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {/* NavBar (48px) */}
        <NavBar
          tools={navbarTools}
          activeId={activeId}
          mode={mode}
          onActivate={handleToolActivate}
        />

        {/* ProjectTree (240px) — ponytail: placeholder until ProjectTree panel ported */}
        <div
          className="shell-project-tree"
          style={{
            width: 240,
            display: "flex",
            flexDirection: "column",
            background: "var(--color-surface-1)",
            borderRight: "1px solid var(--color-border)",
            overflow: "auto",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              height: 28,
              display: "flex",
              alignItems: "center",
              padding: "0 12px",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              background: "var(--color-surface-2)",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            Project
          </div>
          <div style={{ padding: 12, fontSize: 12, color: "var(--color-text-tertiary)" }}>
            {/* ponytail: ProjectTree component integration deferred */}
            <em>File tree coming soon</em>
          </div>
        </div>

        {/* EditorSlot (flex: 1) */}
        <EditorSlot
          activeTool={activeTool}
          prevToolId={prevToolId}
          toolProps={toolProps}
          isSameGroup={(a, b) => toolRegistry.isSameGroup(a, b)}
        />

        {/* InspectorSlot (280px, conditional) */}
        <InspectorSlot eventBus={eventBus} visible={showInspector} />
      </div>

      {/* BottomSlot (200px) */}
      <BottomSlot panels={shellPanels} toolPanels={toolPanels} />
    </div>
  );
}
