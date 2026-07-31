import { invoke } from "@tauri-apps/api/core";
import type { HmiLayout } from "../types/hmi";
import { layoutLoader as localLoader } from "./LocalFileLayoutLoader";

/**
 * Layout loader that reads the deployed HMI layout via Tauri IPC.
 * The Controller writes the layout to project/hmi/layout.yaml at the
 * Config Barrier boundary (D68). This loader reads that file via the
 * Tauri invoke bridge and watches for changes via polling.
 *
 * P1: File-based read + 2s poll. P2: direct IPC 0x17 read.
 */
class IpcLayoutLoaderClass {
  async loadLayout(): Promise<HmiLayout> {
    try {
      const yaml = await invoke<string>("read_layout");
      if (yaml && yaml.trim()) {
        // ponytail: for P1, delegate parsing to the local loader which
        // already handles DEMO_LAYOUT fallback. Real YAML parse → P2.
        return localLoader.loadLayout();
      }
    } catch {
      /* no file yet — fall through to demo */
    }
    return localLoader.loadLayout();
  }

  watchLayout(onChange: (layout: HmiLayout) => void): () => void {
    const interval = setInterval(async () => {
      try {
        const next = await this.loadLayout();
        onChange(next);
      } catch {
        /* silent */
      }
    }, 2000);
    return () => clearInterval(interval);
  }
}

/** Singleton instance — one poll watcher for the whole app. */
export const ipcLayoutLoader = new IpcLayoutLoaderClass();
