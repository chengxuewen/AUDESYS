/**
 * PcAdapter — wraps Tauri desktop APIs behind IPlatformAdapter.
 *
 * This is a thin delegation layer. No Rust-side changes needed.
 * Every method maps 1:1 to the existing @tauri-apps/* calls.
 *
 * Construction: `PcAdapter.create()` — async factory, verifies Tauri runtime.
 */

import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  readTextFile as tauriReadTextFile,
  writeTextFile as tauriWriteTextFile,
} from "@tauri-apps/plugin-fs";
import {
  type IPlatformAdapter,
  type PlatformCapabilities,
  type FileDialogOptions,
  type PlatformMode,
  PlatformNotAvailableError,
} from "./types";

// ── Capabilities (PC = everything on) ────────────────────────────────

const PC_CAPABILITIES: PlatformCapabilities = {
  nativeFileSystem: true,
  nativeProcess: true,
  nativeDebug: true,
  localController: true,
  desktopNotifications: true,
  systemTray: true,
};

// ── Implementation ───────────────────────────────────────────────────

export class PcAdapter implements IPlatformAdapter {
  readonly mode: PlatformMode = "pc";
  readonly capabilities = PC_CAPABILITIES;

  private constructor() {}

  /**
   * Factory — checks that we are running inside Tauri before returning.
   * Throws PlatformNotAvailableError if __TAURI_INTERNALS__ is missing
   * (e.g. someone imports this in a web build by mistake).
   */
  static async create(): Promise<PcAdapter> {
    // ponytail: duck-type Tauri presence; window.__TAURI_INTERNALS__ is the reliable signal
    const w = window as unknown as { __TAURI_INTERNALS__?: unknown };
    if (!w.__TAURI_INTERNALS__) {
      throw new PlatformNotAvailableError("Tauri runtime");
    }
    return new PcAdapter();
  }

  // ── IPC ──

  async invoke<T = unknown>(
    cmd: string,
    args?: Record<string, unknown>,
  ): Promise<T> {
    return tauriInvoke<T>(cmd, args);
  }

  // ── File System ──

  async readTextFile(path: string): Promise<string> {
    return tauriReadTextFile(path);
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    await tauriWriteTextFile(path, content);
  }

  // ── Dialogs ──

  async openFileDialog(
    options: FileDialogOptions,
  ): Promise<string | string[] | null> {
    const result = await open({
      title: options.title,
      filters: options.filters,
      multiple: options.multiple ?? false,
    });
    return result ?? null;
  }

  async saveFileDialog(
    options: FileDialogOptions,
  ): Promise<string | null> {
    const result = await save({
      title: options.title,
      filters: options.filters,
      defaultPath: options.defaultPath,
    });
    return result ?? null;
  }

  // ── Project Persistence (PC: filesystem-based) ──

  /**
   * Save project to `~/.audesys/projects/<name>/`.
   * Creates a `.audesys-project` manifest and writes each file.
   */
  async saveProject(
    name: string,
    files: Record<string, string>,
  ): Promise<void> {
    // ponytail: write manifest + files directly; skip a dedicated project-manifest crate
    const baseDir = `projects/${name}`;
    const manifest = JSON.stringify({ name, files: Object.keys(files) });
    await tauriWriteTextFile(`${baseDir}/.audesys-project`, manifest);
    for (const [relPath, content] of Object.entries(files)) {
      await tauriWriteTextFile(`${baseDir}/${relPath}`, content);
    }
  }

  async loadProject(name: string): Promise<Record<string, string>> {
    const baseDir = `projects/${name}`;
    const manifestRaw = await tauriReadTextFile(`${baseDir}/.audesys-project`);
    const manifest: { name: string; files: string[] } =
      JSON.parse(manifestRaw);
    const result: Record<string, string> = {};
    for (const relPath of manifest.files) {
      result[relPath] = await tauriReadTextFile(`${baseDir}/${relPath}`);
    }
    return result;
  }

  async listProjects(): Promise<string[]> {
    // ponytail: list dirs under projects/; glob doesn't work in Tauri fs plugin,
    // so we rely on Tauri backend command. For now, return empty — project persistence
    // is a Phase 2 feature. Add `invoke("list_projects")` when backend is ready.
    return [];
  }

  async deleteProject(name: string): Promise<void> {
    // ponytail: delete via Tauri command; add `invoke("delete_project", { name })` when ready.
    await tauriInvoke("delete_project", { name });
  }
}
