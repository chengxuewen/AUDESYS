/**
 * AUDESYS Studio PlatformAdapter — types and interfaces.
 *
 * PC mode ("pc"): Tauri desktop — native filesystem, UDS controller, PTY terminal.
 * Web mode ("web"): browser — IndexedDB persistence, WebSocket controller, File API.
 *
 * All shared types that both PcAdapter and WebAdapter implement live here.
 */

// ── Platform Mode ────────────────────────────────────────────────────

/** Runtime execution environment. Detected at boot, immutable afterward. */
export type PlatformMode = "pc" | "web";

// ── Capabilities ─────────────────────────────────────────────────────

/**
 * What the current platform CAN do. Components read this to decide
 * whether to show/hide features or swap implementations.
 *
 * Every boolean is `true` = fully available, `false` = degraded or hidden.
 */
export interface PlatformCapabilities {
  /** Native OS file-system access (browse, read, write without user picker). */
  nativeFileSystem: boolean;

  /** Spawn child processes / PTY terminal. */
  nativeProcess: boolean;

  /** Debug adapter via Unix Domain Socket (DAP over UDS). */
  nativeDebug: boolean;

  /** Controller connection via Unix Domain Socket. */
  localController: boolean;

  /** OS-level notification API (Notification tray / toast). */
  desktopNotifications: boolean;

  /** System tray icon + menu. */
  systemTray: boolean;
}

// ── Dialog Options ───────────────────────────────────────────────────

export interface FileDialogFilter {
  name: string;
  extensions: string[];
}

export interface FileDialogOptions {
  title?: string;
  filters?: FileDialogFilter[];
  /** Only for openFileDialog: allow multi-select. */
  multiple?: boolean;
  /** Only for saveFileDialog: suggested filename. */
  defaultPath?: string;
}

// ── Error Classes ────────────────────────────────────────────────────

/** Thrown when a feature is unavailable in the current platform mode. */
export class PlatformNotAvailableError extends Error {
  constructor(feature: string) {
    super(`Feature "${feature}" is not available in this platform mode`);
    this.name = "PlatformNotAvailableError";
  }
}

/** Thrown when a Web-mode backend returns a non-2xx status. */
export class WebBackendError extends Error {
  constructor(
    public status: number,
    body: string,
  ) {
    super(`Backend error ${status}: ${body.slice(0, 200)}`);
    this.name = "WebBackendError";
  }
}

// ── Core Interface ───────────────────────────────────────────────────

/**
 * AUDESYS Studio platform abstraction layer.
 *
 * Every component gets a reference to this interface (via React Context).
 * No component imports from @tauri-apps/* directly — all platform
 * interaction goes through this adapter.
 */
export interface IPlatformAdapter {
  // ── Identity ──

  /** Which platform is active. Immutable after boot. */
  readonly mode: PlatformMode;

  /** What this platform can do. Components read this, never set it. */
  readonly capabilities: PlatformCapabilities;

  // ── IPC (replaces @tauri-apps/api/core invoke) ──

  /**
   * Invoke a named backend command.
   *
   * PC mode:  forwards to `window.__TAURI_INTERNALS__.invoke()`.
   * Web mode: POST /api/invoke with JSON { cmd, args }.
   */
  invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T>;

  // ── File System ──

  /**
   * Read a file at `path` as UTF-8 text.
   *
   * PC:  direct filesystem read (any path).
   * Web: limited to File API handles or IndexedDB-backed virtual FS.
   */
  readTextFile(path: string): Promise<string>;

  /**
   * Write UTF-8 text to `path`.
   *
   * PC:  direct filesystem write.
   * Web: IndexedDB put (virtual FS keyed by path).
   */
  writeTextFile(path: string, content: string): Promise<void>;

  // ── Dialogs ──

  /**
   * Show a native/open file picker.
   *
   * PC:  `@tauri-apps/plugin-dialog open()`.
   * Web: `<input type="file">` via hidden DOM element.
   *
   * Returns selected path(s) (PC) or File.name (Web).
   */
  openFileDialog(options: FileDialogOptions): Promise<string | string[] | null>;

  /**
   * Show a native save-as dialog.
   *
   * PC:  `@tauri-apps/plugin-dialog save()`.
   * Web: <a download> or shows a filename prompt.
   */
  saveFileDialog(options: FileDialogOptions): Promise<string | null>;

  // ── Project Persistence (multi-file, cross-mode) ──

  /**
   * Save a named project bundle.
   *
   * PC:  writes .audesys-project/ manifest + files adjacent.
   * Web: IndexedDB store keyed by project name.
   *
   * `files` is a flat map of relative-path → content.
   */
  saveProject(name: string, files: Record<string, string>): Promise<void>;

  /**
   * Load a named project bundle.
   * Returns the same flat map given to saveProject.
   */
  loadProject(name: string): Promise<Record<string, string>>;

  /** List saved project names. */
  listProjects(): Promise<string[]>;

  /** Permanently delete a saved project. */
  deleteProject(name: string): Promise<void>;
}
