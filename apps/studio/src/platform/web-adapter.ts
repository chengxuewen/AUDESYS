/**
 * WebAdapter — browser-native implementation of IPlatformAdapter.
 *
 * No Tauri runtime needed. Uses:
 *   - fetch()          → backend HTTP/WebSocket API
 *   - IndexedDB        → project/file persistence
 *   - File API         → file open dialogs (<input type="file">)
 *   - WebSocket        → controller debug connection (DAP transport)
 *
 * Construction: `WebAdapter.create({ backendUrl, wsUrl })`.
 */

import {
  type IPlatformAdapter,
  type PlatformCapabilities,
  type PlatformMode,
  type FileDialogOptions,
  WebBackendError,
} from "./types";

// ── Capabilities (Web = degraded) ────────────────────────────────────

const WEB_CAPABILITIES: PlatformCapabilities = {
  nativeFileSystem: false,
  nativeProcess: false,
  nativeDebug: false,
  localController: false,
  desktopNotifications: false,
  systemTray: false,
};

// ── Config ────────────────────────────────────────────────────────────

export interface WebAdapterConfig {
  /** Backend HTTP API base (e.g. "http://localhost:1420"). POST /api/invoke. */
  backendUrl: string;
  /** DAP WebSocket endpoint (e.g. "ws://localhost:1420/ws/dap"). */
  wsUrl: string;
}

// ── Implementation ───────────────────────────────────────────────────

export class WebAdapter implements IPlatformAdapter {
  readonly mode: PlatformMode = "web";
  readonly capabilities = WEB_CAPABILITIES;

  private readonly backendUrl: string;
  readonly wsUrl: string;

  private constructor(config: WebAdapterConfig) {
    // ponytail: strip trailing slash so path concatenation is predictable
    this.backendUrl = config.backendUrl.replace(/\/+$/, "");
    this.wsUrl = config.wsUrl;
  }

  static async create(config: WebAdapterConfig): Promise<WebAdapter> {
    return new WebAdapter(config);
  }

  // ── IPC ──

  /**
   * Web-mode invoke: POST /api/invoke with JSON { cmd, args }.
   *
   * The backend is expected to run the same Tauri command handlers
   * behind an HTTP bridge (Rust: axum/warp route → same handler fn).
   */
  async invoke<T = unknown>(
    cmd: string,
    args?: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch(`${this.backendUrl}/api/invoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd, args: args ?? {} }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      throw new WebBackendError(res.status, body);
    }
    return res.json() as Promise<T>;
  }

  // ── File System ──

  /**
   * Read text from the virtual file system (IndexedDB).
   *
   * In web mode there is no real filesystem — "paths" are keys
   * in an IndexedDB object store.
   */
  async readTextFile(path: string): Promise<string> {
    const db = await this.openVfsDb();
    return this.vfsGet(db, path);
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    const db = await this.openVfsDb();
    await this.vfsPut(db, path, content);
  }

  // ── Dialogs ──

  /**
   * Open file dialog via hidden <input type="file"> element.
   *
   * Returns File.name (not a real path) for single-select,
   * or an array of names for multi-select.
   *
   * The caller is responsible for reading from FileReader/Symbol.asyncIterator.
   */
  async openFileDialog(
    options: FileDialogOptions,
  ): Promise<string | string[] | null> {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = options.multiple ?? false;
      if (options.filters?.length) {
        // ponytail: map { name, extensions[] } → accept string
        input.accept = options.filters
          .flatMap((f) => f.extensions.map((ext) => `.${ext}`))
          .join(",");
      }

      // ponytail: cleanup after dialog closes
      const cleanup = () => {
        input.remove();
        // If cancelled before any change event fires
      };

      input.onchange = () => {
        const files = input.files;
        if (!files || files.length === 0) {
          resolve(null);
          cleanup();
          return;
        }
        if (options.multiple) {
          resolve(Array.from(files).map((f) => f.name));
        } else {
          resolve(files[0].name);
        }
        cleanup();
      };

      // ponytail: detect cancel via focus loss + no change
      input.oncancel = () => {
        resolve(null);
        cleanup();
      };

      // hidden element — must be in DOM for some browsers
      input.style.display = "none";
      document.body.appendChild(input);
      input.click();
    });
  }

  /**
   * Save file dialog — in web mode, triggers a download.
   *
   * Returns the filename chosen (or null).
   * ponytail: browser has no native "save as" picker that returns a path,
   * so we prompt for a filename and trigger <a download>.
   */
  async saveFileDialog(
    options: FileDialogOptions,
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const defaultName = options.defaultPath ?? "untitled";
      // ponytail: simple prompt for filename; replace with showSaveFilePicker
      // when browser support is broad enough
      const filename = window.prompt("Save as:", defaultName);
      resolve(filename);
    });
  }

  // ── Project Persistence (Web: IndexedDB) ──

  async saveProject(
    name: string,
    files: Record<string, string>,
  ): Promise<void> {
    const db = await this.openVfsDb();
    const tx = db.transaction("projects", "readwrite");
    const store = tx.objectStore("projects");
    store.put({ name, files, updatedAt: Date.now() });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async loadProject(name: string): Promise<Record<string, string>> {
    const db = await this.openVfsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("projects", "readonly");
      const req = tx.objectStore("projects").get(name);
      req.onsuccess = () => {
        resolve(req.result?.files ?? {});
      };
      req.onerror = () => reject(req.error);
    });
  }

  async listProjects(): Promise<string[]> {
    const db = await this.openVfsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("projects", "readonly");
      const req = tx.objectStore("projects").getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteProject(name: string): Promise<void> {
    const db = await this.openVfsDb();
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").delete(name);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ── Internal: IndexedDB helpers ─────────────────────────────────────

  private dbPromise: Promise<IDBDatabase> | null = null;

  private openVfsDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open("audesys-studio", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("vfs")) {
          db.createObjectStore("vfs");
        }
        if (!db.objectStoreNames.contains("projects")) {
          db.createObjectStore("projects", { keyPath: "name" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  private vfsGet(db: IDBDatabase, path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("vfs", "readonly");
      const req = tx.objectStore("vfs").get(path);
      req.onsuccess = () => resolve(req.result ?? "");
      req.onerror = () => reject(req.error);
    });
  }

  private vfsPut(db: IDBDatabase, path: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("vfs", "readwrite");
      tx.objectStore("vfs").put(content, path);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
