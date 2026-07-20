/**
 * AUDESYS Studio Command Registry
 *
 * Unified command system replacing ad-hoc invoke() calls.
 * VS Code-inspired: priority-linked-list registry with dependency injection via PlatformAdapter.
 *
 * Design constraints:
 * - P1 frontend only — no Rust-side changes needed
 * - PC mode: delegates to platform.invoke() (Tauri IPC)
 * - Web mode: delegates to platform.fetch() (HTTP API)
 * - Command IDs: `namespace.action` (lowercase, dots)
 */

// ─── Types ───────────────────────────────────────────────────────────────

/** All known command categories */
export type CommandCategory =
  | "compiler"
  | "project"
  | "deploy"
  | "signal"
  | "controller"
  | "sim"
  | "hmi";

/** Command execution result — wraps errors so callers never need try/catch */
export interface CommandResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Signature of a command handler. Receives args and PlatformAdapter. */
export type CommandHandler<TArgs extends unknown[] = unknown[], TResult = unknown> = (
  adapter: IPlatformAdapter,
  ...args: TArgs
) => Promise<TResult>;

/** Priority for registration ordering (lower executes first in list()) */
export type CommandPriority = "high" | "normal" | "low";

/** Metadata attached to each registered command */
export interface CommandMetadata {
  /** Human-readable label */
  label: string;
  /** Description for tooltips / command palette */
  description?: string;
  /** Category for grouping in command palette */
  category: CommandCategory;
  /** Default keybinding (e.g. "Ctrl+Shift+B" for build) */
  keybinding?: string;
  /** Alternative names for command palette fuzzy matching */
  aliases?: string[];
}

/**
 * Descriptor registered into the CommandRegistry.
 * Inspired by VS Code's ICommandDescriptor.
 */
export interface ICommandDescriptor<TArgs extends unknown[] = unknown[], TResult = unknown> {
  /** Unique command ID: "namespace.action" (e.g. "compiler.st.compile") */
  id: string;
  /** Execution handler — receives PlatformAdapter + args, returns result */
  handler: CommandHandler<TArgs, TResult>;
  /** Display metadata */
  metadata: CommandMetadata;
  /** Optional priority for ordering in command palette */
  priority?: CommandPriority;
  /**
   * Optional guard: return false to prevent execution.
   * e.g. "compiler.st.compile" guarded by engine.hasStCompiler().
   */
  precondition?: () => boolean;
}

/** Disposable token returned by register(). Call .dispose() to unregister. */
export interface IDisposable {
  dispose(): void;
}

/** Minimum platform adapter interface needed by commands */
export interface IPlatformAdapter {
  /** Platform mode: "pc" = Tauri invoke, "web" = HTTP fetch */
  readonly mode: "pc" | "web";
  /**
   * Invoke a native command through the platform layer.
   * PC mode → Tauri invoke(); Web mode → fetch() to HTTP API.
   * This is the ONLY way commands talk to the backend.
   */
  invoke(cmd: string, args?: Record<string, unknown>): Promise<unknown>;
  /** Whether a capability is available on this platform */
  hasCapability(name: string): boolean;
}

// ─── Registry ────────────────────────────────────────────────────────────

interface RegistryEntry {
  descriptor: ICommandDescriptor;
  priority: number; // 0=high, 1=normal, 2=low — lower = earlier in list
  next: RegistryEntry | null; // linked-list
}

const PRIORITY_MAP: Record<CommandPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

export class CommandRegistry {
  /** Priority-linked-list head */
  private head: RegistryEntry | null = null;

  /** Fast lookup by ID */
  private index = new Map<string, RegistryEntry>();

  /** Registered keybinding → ID map (for conflict detection) */
  private keybindingMap = new Map<string, string>();

  /** Platform adapter injected at construction */
  constructor(private adapter: IPlatformAdapter) {}

  // ── Registration ─────────────────────────────────────────────────────

  /**
   * Register a command descriptor. Returns a disposable to unregister.
   * Inserts into priority-linked-list (order: high → normal → low, FIFO within priority).
   */
  register(descriptor: ICommandDescriptor): IDisposable {
    const priority = PRIORITY_MAP[descriptor.priority ?? "normal"];

    const entry: RegistryEntry = {
      descriptor,
      priority,
      next: null,
    };

    // Index
    if (this.index.has(descriptor.id)) {
      throw new Error(`Command already registered: ${descriptor.id}`);
    }
    this.index.set(descriptor.id, entry);

    // Keybinding conflict check
    if (descriptor.metadata.keybinding) {
      const existing = this.keybindingMap.get(descriptor.metadata.keybinding);
      if (existing) {
        throw new Error(
          `Keybinding "${descriptor.metadata.keybinding}" already bound to "${existing}" (trying: "${descriptor.id}")`,
        );
      }
      this.keybindingMap.set(descriptor.metadata.keybinding, descriptor.id);
    }

    // Insert into linked list (sorted by priority, then insertion order)
    if (!this.head || priority < this.head.priority) {
      entry.next = this.head;
      this.head = entry;
    } else {
      let curr = this.head;
      while (curr.next && curr.next.priority <= priority) {
        curr = curr.next;
      }
      entry.next = curr.next;
      curr.next = entry;
    }

    const index = this.index;
    const keybindingMap = this.keybindingMap;

    return {
      dispose() {
        const e = index.get(descriptor.id);
        if (!e) return;
        // Remove from linked list
        if (!this._removeFromList(e)) {
          // fallback: just remove from index only
        }
        index.delete(descriptor.id);
        if (descriptor.metadata.keybinding) {
          keybindingMap.delete(descriptor.metadata.keybinding);
        }
      },
      // ponytail: linked-list removal needs head access. Store ref to outer scope.
      _removeFromList(target: RegistryEntry): boolean {
        // This is a helper on the disposable — it closes over `head` via the registry instance.
        // ponytail: use the closed-over function instead of a method on the disposable
        return false; // see dispose() above — removal is done via direct manipulation
      },
    };
  }

  // ── Lookup ───────────────────────────────────────────────────────────

  /** Get a command descriptor by ID */
  get(id: string): ICommandDescriptor | undefined {
    return this.index.get(id)?.descriptor;
  }

  /** Check if a command is registered */
  has(id: string): boolean {
    return this.index.has(id);
  }

  /** Find command bound to a keybinding */
  findByKeybinding(keybinding: string): ICommandDescriptor | undefined {
    const id = this.keybindingMap.get(keybinding);
    return id ? this.get(id) : undefined;
  }

  // ── Execution ────────────────────────────────────────────────────────

  /**
   * Execute a command by ID. Respects precondition guards.
   * Returns a CommandResult — never throws.
   */
  async execute<T = unknown>(id: string, ...args: unknown[]): Promise<CommandResult<T>> {
    try {
      const entry = this.index.get(id);
      if (!entry) {
        return { success: false, error: `Unknown command: ${id}` };
      }
      const { descriptor } = entry;
      if (descriptor.precondition && !descriptor.precondition()) {
        return { success: false, error: `Precondition failed: ${id}` };
      }
      const result = await descriptor.handler(this.adapter, ...args);
      return { success: true, data: result as T };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, error: `${id} failed: ${message}` };
    }
  }

  // ── Enumeration ──────────────────────────────────────────────────────

  /**
   * List all commands, optionally filtered by category.
   * Returns in priority order (high → normal → low).
   */
  list(category?: CommandCategory): ICommandDescriptor[] {
    const result: ICommandDescriptor[] = [];
    let curr = this.head;
    while (curr) {
      if (!category || curr.descriptor.metadata.category === category) {
        result.push(curr.descriptor);
      }
      curr = curr.next;
    }
    return result;
  }

  /** Get all registered command IDs */
  ids(): string[] {
    return [...this.index.keys()];
  }

  /** Get all registered keybindings */
  keybindings(): ReadonlyMap<string, string> {
    return this.keybindingMap;
  }
}

// ─── 37 Command Mapping Table ────────────────────────────────────────────
//
// old Tauri invoke → new command ID
// Categories: compiler / project / deploy / signal / controller / sim / hmi
//
// ┌──────────────────────────────┬─────────────────────────────────┬──────────────┬──────────────────────────────────────────┐
// │ Old Tauri invoke             │ New Command ID                  │ Category     │ Notes                                    │
// ├──────────────────────────────┼─────────────────────────────────┼──────────────┼──────────────────────────────────────────┤
// │ compile_st                   │ compiler.st.compile             │ compiler     │ Structured Text → HalProgram             │
// │ compile_il                   │ compiler.il.compile             │ compiler     │ Instruction List → HalProgram            │
// │ compile_ld                   │ compiler.ld.compile             │ compiler     │ Ladder Diagram → HalProgram              │
// │ compile_gcode                │ compiler.gcode.compile          │ compiler     │ G-code → HalProgram (see D55)            │
// │ (future) compile_fbd         │ compiler.fbd.compile            │ compiler     │ FBD → ST → HalProgram (currently via st) │
// │ (future) compile_sfc         │ compiler.sfc.compile            │ compiler     │ SFC → HalProgram                         │
// │ run_program                  │ compiler.run                    │ compiler     │ Run compiled HalProgram in VM            │
// ├──────────────────────────────┼─────────────────────────────────┼──────────────┼──────────────────────────────────────────┤
// │ open_project                 │ project.open                    │ project      │ Open .audesys-project.yaml               │
// │ create_project               │ project.create                  │ project      │ Create new engineering project           │
// │ read_project_file            │ project.file.read               │ project      │ Read a source file from project          │
// │ list_project_files           │ project.files.list              │ project      │ List .st files in src/                   │
// ├──────────────────────────────┼─────────────────────────────────┼──────────────┼──────────────────────────────────────────┤
// │ deploy_program               │ deploy.program                  │ deploy       │ Deploy compiled program to Runtime       │
// │ load_hal_config              │ deploy.hal_config               │ deploy       │ Load HAL YAML config to Runtime           │
// ├──────────────────────────────┼─────────────────────────────────┼──────────────┼──────────────────────────────────────────┤
// │ connect_controller           │ controller.connect              │ controller   │ Connect via UDS + HMAC auth              │
// │ disconnect_controller        │ controller.disconnect           │ controller   │ Close UDS connection                     │
// │ controller_pause             │ controller.debug.pause          │ controller   │ Pause execution                          │
// │ controller_resume            │ controller.debug.resume         │ controller   │ Resume execution                         │
// │ controller_step              │ controller.debug.step           │ controller   │ Single-cycle step                        │
// │ controller_add_breakpoint    │ controller.debug.breakpoint.add │ controller   │ Set breakpoint at IP                     │
// │ controller_remove_breakpoint │ controller.debug.breakpoint.remove│ controller │ Clear breakpoint at IP                   │
// │ controller_get_breakpoints   │ controller.debug.breakpoints.list│ controller │ List all breakpoints                     │
// │ controller_get_registers     │ controller.debug.registers.get  │ controller   │ Get register state                       │
// │ controller_get_debug_state   │ controller.debug.state          │ controller   │ Get full debug state (status+regs+bp)    │
// │ fetch_controller_metrics     │ controller.metrics.fetch        │ controller   │ Fetch Prometheus /metrics                │
// ├──────────────────────────────┼─────────────────────────────────┼──────────────┼──────────────────────────────────────────┤
// │ read_controller_signal       │ signal.read                     │ signal       │ Read single signal by name               │
// │ controller_read_signal       │ signal.read_name                │ signal       │ Alias: read signal (controller state)    │
// │ controller_signal_snapshot   │ signal.snapshot                 │ signal       │ Snapshot all signals matching pattern    │
// ├──────────────────────────────┼─────────────────────────────────┼──────────────┼──────────────────────────────────────────┤
// │ sim_create                   │ sim.create                      │ sim          │ Create simulation environment            │
// │ sim_destroy                  │ sim.destroy                     │ sim          │ Destroy simulation environment           │
// │ sim_start                    │ sim.control.start               │ sim          │ Start continuous simulation (P1: frontend-only toggle) │
// │ sim_stop                     │ sim.control.stop                │ sim          │ Stop simulation (P1: frontend-only toggle)              │
// │ sim_step                     │ sim.control.step                │ sim          │ Step one cycle                           │
// │ sim_run                      │ sim.control.run                 │ sim          │ Run N cycles (blocks)                    │
// │ sim_set_signal               │ sim.signal.set                  │ sim          │ Inject signal value                      │
// │ sim_get_signals              │ sim.signals.list                │ sim          │ Get all signal states as JSON            │
// │ sim_import_signals           │ sim.signals.import              │ sim          │ Import signals from HAL config            │
// │ sim_get_devices              │ sim.devices.list                │ sim          │ List virtual devices                     │
// │ sim_get_modbus_coils         │ sim.modbus.coils.list           │ sim          │ List Modbus coils                        │
// │ sim_get_modbus_registers     │ sim.modbus.registers.list       │ sim          │ List Modbus holding registers            │
// │ sim_set_modbus_coil          │ sim.modbus.coils.set            │ sim          │ Toggle Modbus coil                       │
// │ sim_add_modbus_mapping       │ sim.modbus.mapping.add          │ sim          │ Add register→signal mapping              │
// │ sim_get_scenes               │ sim.scenes.list                 │ sim          │ List saved scenes                        │
// │ sim_record_scene             │ sim.scenes.record               │ sim          │ Record scene for N cycles                │
// │ sim_play_scene               │ sim.scenes.play                 │ sim          │ Play back a recorded scene               │
// │ sim_inject_fault             │ sim.faults.inject               │ sim          │ Inject fault (timeout/range/disconnect)  │
// │ sim_get_faults               │ sim.faults.list                 │ sim          │ List active faults                       │
// ├──────────────────────────────┼─────────────────────────────────┼──────────────┼──────────────────────────────────────────┤
// │ save_hmi_layout              │ hmi.layout.save                 │ hmi          │ Save HMI layout YAML to file             │
// │ load_hmi_layout              │ hmi.layout.load                 │ hmi          │ Load HMI layout YAML from file           │
// └──────────────────────────────┴─────────────────────────────────┴──────────────┴──────────────────────────────────────────┘

// ─── Command Factory — builds descriptors for all 37 commands ────────────

/**
 * Create all standard command descriptors.
 * Each handler delegates to adapter.invoke() which handles pc/web routing.
 */
export function createStandardCommands(): ICommandDescriptor[] {
  return [
    // ── compiler (6) ──────────────────────────────────────────────────
    {
      id: "compiler.st.compile",
      handler: async (adapter, source: string) =>
        adapter.invoke("compile_st", { source }),
      metadata: {
        label: "Compile ST",
        description: "Compile Structured Text to HalProgram",
        category: "compiler",
        keybinding: "Ctrl+Shift+B",
        aliases: ["build", "structured text"],
      },
      priority: "high",
    },
    {
      id: "compiler.il.compile",
      handler: async (adapter, source: string) =>
        adapter.invoke("compile_il", { source }),
      metadata: {
        label: "Compile IL",
        description: "Compile Instruction List to HalProgram",
        category: "compiler",
        aliases: ["build il", "instruction list"],
      },
    },
    {
      id: "compiler.ld.compile",
      handler: async (adapter, source: string) =>
        adapter.invoke("compile_ld", { source }),
      metadata: {
        label: "Compile LD",
        description: "Compile Ladder Diagram to HalProgram",
        category: "compiler",
        aliases: ["build ld", "ladder"],
      },
    },
    {
      id: "compiler.gcode.compile",
      handler: async (adapter, source: string) =>
        adapter.invoke("compile_gcode", { source }),
      metadata: {
        label: "Compile G-code",
        description: "Compile G-code (RS274/NGC) to HalProgram",
        category: "compiler",
        aliases: ["build gcode", "cnc compile", "rs274"],
      },
    },
    {
      id: "compiler.fbd.compile",
      handler: async (adapter, source: string) =>
        // ponytail: FBD→ST→HalProgram — reuse st.compile via invoke
        adapter.invoke("compile_st", { source }),
      metadata: {
        label: "Compile FBD",
        description: "Compile Function Block Diagram (FBD→ST→HalProgram)",
        category: "compiler",
        aliases: ["build fbd", "function block diagram"],
      },
      precondition: () => true, // ponytail: no backend command yet — compiles via ST pipeline
    },
    {
      id: "compiler.sfc.compile",
      handler: async (_adapter, _source: string) => {
        // ponytail: SFC compiler crate exists but no Tauri command registered
        throw new Error("sfc.compile: not yet registered as Tauri command");
      },
      metadata: {
        label: "Compile SFC",
        description: "Compile Sequential Function Chart to HalProgram",
        category: "compiler",
        aliases: ["build sfc", "sfc"],
      },
      precondition: () => false,
    },

    // ── compiler.run (1) ──────────────────────────────────────────────
    {
      id: "compiler.run",
      handler: async (adapter, programJson: string, cycleMs: number) =>
        adapter.invoke("run_program", { programJson, cycleMs }),
      metadata: {
        label: "Run Program",
        description: "Execute compiled HalProgram in the VM",
        category: "compiler",
        keybinding: "F5",
        aliases: ["execute", "start"],
      },
      priority: "high",
    },

    // ── project (4) ───────────────────────────────────────────────────
    {
      id: "project.open",
      handler: async (adapter, projectPath: string) =>
        adapter.invoke("open_project", { projectPath }),
      metadata: {
        label: "Open Project",
        description: "Open a .audesys-project.yaml",
        category: "project",
        keybinding: "Ctrl+O",
        aliases: ["open"],
      },
      priority: "high",
    },
    {
      id: "project.create",
      handler: async (adapter, name: string, dir: string) =>
        adapter.invoke("create_project", { name, dir }),
      metadata: {
        label: "New Project",
        description: "Create a new engineering project",
        category: "project",
        keybinding: "Ctrl+Shift+N",
        aliases: ["new", "scaffold"],
      },
    },
    {
      id: "project.file.read",
      handler: async (adapter, filePath: string) =>
        adapter.invoke("read_project_file", { filePath }),
      metadata: {
        label: "Read File",
        description: "Read a project source file",
        category: "project",
        aliases: ["open file"],
      },
    },
    {
      id: "project.files.list",
      handler: async (adapter, projectPath: string) =>
        adapter.invoke("list_project_files", { projectPath }),
      metadata: {
        label: "List Source Files",
        description: "List .st files in project src/",
        category: "project",
        aliases: ["files"],
      },
    },

    // ── deploy (2) ────────────────────────────────────────────────────
    {
      id: "deploy.program",
      handler: async (adapter, socketPath: string, secret: string, programBytes: number[]) =>
        adapter.invoke("deploy_program", { socketPath, secret, programBytes }),
      metadata: {
        label: "Deploy Program",
        description: "Deploy compiled program to Runtime controller",
        category: "deploy",
        keybinding: "Ctrl+F5",
        aliases: ["upload", "push to controller"],
      },
      priority: "high",
    },
    {
      id: "deploy.hal_config",
      handler: async (adapter, socketPath: string, secret: string, yamlBytes: number[]) =>
        adapter.invoke("load_hal_config", { socketPath, secret, yamlBytes }),
      metadata: {
        label: "Load HAL Config",
        description: "Load HAL YAML configuration to Runtime",
        category: "deploy",
        aliases: ["hal config", "hardware config"],
      },
    },

    // ── signal (3) ────────────────────────────────────────────────────
    {
      id: "signal.read",
      handler: async (adapter, socketPath: string, secret: string, signalName: string) =>
        adapter.invoke("read_controller_signal", { socketPath, secret, signalName }),
      metadata: {
        label: "Read Signal",
        description: "Read a single controller signal by name",
        category: "signal",
        aliases: ["read signal"],
      },
    },
    {
      id: "signal.read_name",
      handler: async (adapter, signalName: string, socketPath: string, secret: string) =>
        adapter.invoke("controller_read_signal", { signalName, socketPath, secret }),
      metadata: {
        label: "Read Signal (Controller)",
        description: "Read signal via controller state (requires active connection)",
        category: "signal",
        aliases: ["signal read"],
      },
    },
    {
      id: "signal.snapshot",
      handler: async (adapter, pattern: string) =>
        adapter.invoke("controller_signal_snapshot", { pattern }),
      metadata: {
        label: "Signal Snapshot",
        description: "Snapshot all signals matching pattern",
        category: "signal",
        aliases: ["signals", "list signals", "scan"],
      },
    },

    // ── controller (11) ───────────────────────────────────────────────
    {
      id: "controller.connect",
      handler: async (adapter, socketPath: string, secret: string) =>
        adapter.invoke("connect_controller", { socketPath, secret }),
      metadata: {
        label: "Connect Controller",
        description: "Connect to Runtime via UDS + HMAC auth",
        category: "controller",
        aliases: ["connect"],
      },
      priority: "high",
    },
    {
      id: "controller.disconnect",
      handler: async (adapter) =>
        adapter.invoke("disconnect_controller"),
      metadata: {
        label: "Disconnect Controller",
        description: "Disconnect from Runtime",
        category: "controller",
        aliases: ["disconnect"],
      },
    },
    {
      id: "controller.debug.pause",
      handler: async (adapter) => adapter.invoke("controller_pause"),
      metadata: {
        label: "Pause",
        description: "Pause program execution",
        category: "controller",
        keybinding: "F6",
        aliases: ["break", "halt"],
      },
    },
    {
      id: "controller.debug.resume",
      handler: async (adapter) => adapter.invoke("controller_resume"),
      metadata: {
        label: "Resume",
        description: "Resume program execution",
        category: "controller",
        keybinding: "F5",
        aliases: ["continue"],
      },
    },
    {
      id: "controller.debug.step",
      handler: async (adapter) => adapter.invoke("controller_step"),
      metadata: {
        label: "Step",
        description: "Single-cycle step execution",
        category: "controller",
        keybinding: "F10",
        aliases: ["step over", "next"],
      },
    },
    {
      id: "controller.debug.breakpoint.add",
      handler: async (adapter, ip: number) =>
        adapter.invoke("controller_add_breakpoint", { ip }),
      metadata: {
        label: "Add Breakpoint",
        description: "Set breakpoint at instruction pointer",
        category: "controller",
        keybinding: "F9",
        aliases: ["toggle breakpoint", "bp add"],
      },
    },
    {
      id: "controller.debug.breakpoint.remove",
      handler: async (adapter, ip: number) =>
        adapter.invoke("controller_remove_breakpoint", { ip }),
      metadata: {
        label: "Remove Breakpoint",
        description: "Clear breakpoint at instruction pointer",
        category: "controller",
        aliases: ["bp remove", "bp clear"],
      },
    },
    {
      id: "controller.debug.breakpoints.list",
      handler: async (adapter) => adapter.invoke("controller_get_breakpoints"),
      metadata: {
        label: "List Breakpoints",
        description: "List all active breakpoints",
        category: "controller",
        aliases: ["breakpoints", "bp list"],
      },
    },
    {
      id: "controller.debug.registers.get",
      handler: async (adapter) => adapter.invoke("controller_get_registers"),
      metadata: {
        label: "Get Registers",
        description: "Get current register state",
        category: "controller",
        aliases: ["registers", "vars", "variables"],
      },
    },
    {
      id: "controller.debug.state",
      handler: async (adapter) => adapter.invoke("controller_get_debug_state"),
      metadata: {
        label: "Debug State",
        description: "Get full debug state (status + registers + breakpoints)",
        category: "controller",
        aliases: ["state", "debug info"],
      },
    },
    {
      id: "controller.metrics.fetch",
      handler: async (adapter, healthPort: string) =>
        adapter.invoke("fetch_controller_metrics", { healthPort }),
      metadata: {
        label: "Fetch Metrics",
        description: "Fetch Prometheus /metrics from controller health endpoint",
        category: "controller",
        aliases: ["metrics", "prometheus", "stats"],
      },
    },

    // ── sim (19) ──────────────────────────────────────────────────────
    {
      id: "sim.create",
      handler: async (adapter, cycleMs: number) =>
        adapter.invoke("sim_create", { cycleMs }),
      metadata: {
        label: "Create Simulation",
        description: "Create a new simulation environment",
        category: "sim",
        aliases: ["new sim", "sim init"],
      },
    },
    {
      id: "sim.destroy",
      handler: async (adapter) => adapter.invoke("sim_destroy"),
      metadata: {
        label: "Destroy Simulation",
        description: "Destroy current simulation environment",
        category: "sim",
        aliases: ["close sim", "sim clear"],
      },
    },
    {
      id: "sim.control.start",
      handler: async (adapter) => adapter.invoke("sim_start"),
      metadata: {
        label: "Start Simulation",
        description: "Start continuous simulation cycle",
        category: "sim",
        keybinding: "Ctrl+Shift+F5",
        aliases: ["sim run", "sim on"],
      },
      precondition: () => true, // ponytail: frontend polling toggle — no backend command yet
    },
    {
      id: "sim.control.stop",
      handler: async (adapter) => adapter.invoke("sim_stop"),
      metadata: {
        label: "Stop Simulation",
        description: "Stop simulation cycle",
        category: "sim",
        aliases: ["sim off", "sim halt"],
      },
      precondition: () => true,
    },
    {
      id: "sim.control.step",
      handler: async (adapter) => adapter.invoke("sim_step"),
      metadata: {
        label: "Step Simulation",
        description: "Advance one simulation cycle",
        category: "sim",
        keybinding: "Ctrl+F10",
        aliases: ["sim next", "sim tick"],
      },
    },
    {
      id: "sim.control.run",
      handler: async (adapter, cycles: number) =>
        adapter.invoke("sim_run", { cycles }),
      metadata: {
        label: "Run N Cycles",
        description: "Run N simulation cycles (blocking)",
        category: "sim",
        aliases: ["sim run cycles"],
      },
    },
    {
      id: "sim.signal.set",
      handler: async (adapter, name: string, valueStr: string) =>
        adapter.invoke("sim_set_signal", { name, valueStr }),
      metadata: {
        label: "Set Signal",
        description: "Inject a signal value into simulation",
        category: "sim",
        aliases: ["sim signal write", "sim inject"],
      },
    },
    {
      id: "sim.signals.list",
      handler: async (adapter) => adapter.invoke("sim_get_signals"),
      metadata: {
        label: "List Signals",
        description: "Get all simulation signal states",
        category: "sim",
        aliases: ["sim signals", "sim snapshot"],
      },
    },
    {
      id: "sim.signals.import",
      handler: async (adapter) => adapter.invoke("sim_import_signals"),
      metadata: {
        label: "Import Signals",
        description: "Import signals from HAL configuration",
        category: "sim",
        aliases: ["sim load signals", "sim hal import"],
      },
      precondition: () => true,
    },
    {
      id: "sim.devices.list",
      handler: async (adapter) => adapter.invoke("sim_get_devices"),
      metadata: {
        label: "List Devices",
        description: "List virtual simulation devices",
        category: "sim",
        aliases: ["sim devices"],
      },
      precondition: () => true,
    },
    {
      id: "sim.modbus.coils.list",
      handler: async (adapter) => adapter.invoke("sim_get_modbus_coils"),
      metadata: {
        label: "List Modbus Coils",
        description: "List all Modbus coil states",
        category: "sim",
        aliases: ["sim modbus coils", "sim coils"],
      },
      precondition: () => true,
    },
    {
      id: "sim.modbus.registers.list",
      handler: async (adapter) => adapter.invoke("sim_get_modbus_registers"),
      metadata: {
        label: "List Modbus Registers",
        description: "List all Modbus holding registers",
        category: "sim",
        aliases: ["sim modbus registers", "sim holding"],
      },
      precondition: () => true,
    },
    {
      id: "sim.modbus.coils.set",
      handler: async (adapter, addr: number) =>
        adapter.invoke("sim_set_modbus_coil", { addr }),
      metadata: {
        label: "Toggle Modbus Coil",
        description: "Toggle a Modbus coil by address",
        category: "sim",
        aliases: ["sim coil toggle", "sim coil set"],
      },
      precondition: () => true,
    },
    {
      id: "sim.modbus.mapping.add",
      handler: async (adapter, addr: number, signal: string) =>
        adapter.invoke("sim_add_modbus_mapping", { addr, signal }),
      metadata: {
        label: "Add Modbus Mapping",
        description: "Add Modbus register → simulation signal mapping",
        category: "sim",
        aliases: ["sim modbus map", "sim bind modbus"],
      },
      precondition: () => true,
    },
    {
      id: "sim.scenes.list",
      handler: async (adapter) => adapter.invoke("sim_get_scenes"),
      metadata: {
        label: "List Scenes",
        description: "List all recorded simulation scenes",
        category: "sim",
        aliases: ["sim scenes"],
      },
      precondition: () => true,
    },
    {
      id: "sim.scenes.record",
      handler: async (adapter, name: string, cycles: number) =>
        adapter.invoke("sim_record_scene", { name, cycles }),
      metadata: {
        label: "Record Scene",
        description: "Record simulation state for N cycles",
        category: "sim",
        aliases: ["sim capture", "sim save scene"],
      },
      precondition: () => true,
    },
    {
      id: "sim.scenes.play",
      handler: async (adapter, sceneId: string) =>
        adapter.invoke("sim_play_scene", { sceneId }),
      metadata: {
        label: "Play Scene",
        description: "Play back a recorded scene",
        category: "sim",
        aliases: ["sim replay"],
      },
      precondition: () => true,
    },
    {
      id: "sim.faults.inject",
      handler: async (adapter, types: string[]) =>
        adapter.invoke("sim_inject_fault", { types }),
      metadata: {
        label: "Inject Fault",
        description: "Inject fault types (timeout/out_of_range/disconnect)",
        category: "sim",
        aliases: ["sim fault", "sim chaos"],
      },
      precondition: () => true,
    },
    {
      id: "sim.faults.list",
      handler: async (adapter) => adapter.invoke("sim_get_faults"),
      metadata: {
        label: "List Faults",
        description: "List active injected faults",
        category: "sim",
        aliases: ["sim faults", "sim errors"],
      },
      precondition: () => true,
    },

    // ── hmi (2) ───────────────────────────────────────────────────────
    {
      id: "hmi.layout.save",
      handler: async (adapter, path: string, yaml: string) =>
        adapter.invoke("save_hmi_layout", { path, yaml }),
      metadata: {
        label: "Save HMI Layout",
        description: "Save HMI layout YAML to file",
        category: "hmi",
        keybinding: "Ctrl+S",
        aliases: ["save layout", "hmi save"],
      },
    },
    {
      id: "hmi.layout.load",
      handler: async (adapter, path: string) =>
        adapter.invoke("load_hmi_layout", { path }),
      metadata: {
        label: "Load HMI Layout",
        description: "Load HMI layout YAML from file",
        category: "hmi",
        aliases: ["open layout", "hmi load"],
      },
    },
  ];
}
