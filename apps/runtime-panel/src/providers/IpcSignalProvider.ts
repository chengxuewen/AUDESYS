import { invoke } from "@tauri-apps/api/core";
import type { ISignalProvider } from "./ISignalProvider";

/**
 * ISignalProvider backed by real Controller IPC via Tauri invoke.
 * P1: 100ms polling per D62 hybrid mode. P2: push via 0x16 SIGNAL_PUSH.
 */
export class IpcSignalProvider implements ISignalProvider {
  private socketPath = "/tmp/audesys-controller.sock";
  private secret = "dev-secret";
  private connected = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Array<{
    names: string[];
    onChange: (signals: Record<string, string | null>) => void;
  }> = [];
  private activeNames: Set<string> = new Set();

  setConnectionParams(socketPath: string, secret: string): void {
    this.socketPath = socketPath;
    this.secret = secret;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    try {
      await invoke("connect_controller", {
        socketPath: this.socketPath,
        secret: this.secret,
      });
      this.connected = true;
      this.startPolling();
    } catch (e) {
      console.warn("[IpcSignalProvider] connect failed:", e);
    }
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    if (!this.connected) return;
    try {
      await invoke("disconnect_controller");
    } catch {
      /* connection already dead */
    }
    this.connected = false;
  }

  async readSignal(name: string): Promise<string | null> {
    if (!this.connected) return null;
    try {
      return await invoke<string>("read_signal", { name });
    } catch {
      return null;
    }
  }

  subscribeSignals(
    names: string[],
    onChange: (signals: Record<string, string | null>) => void,
  ): () => void {
    const entry = { names, onChange };
    this.listeners.push(entry);
    for (const n of names) this.activeNames.add(n);
    if (this.connected) this.startPolling();
    return () => {
      this.listeners = this.listeners.filter((l) => l !== entry);
      this.activeNames = new Set(this.listeners.flatMap((l) => l.names));
      if (this.activeNames.size === 0) this.stopPolling();
    };
  }

  // ── private ──

  private startPolling(): void {
    if (this.pollTimer || this.activeNames.size === 0 || !this.connected) return;
    this.pollTimer = setInterval(async () => {
      if (this.activeNames.size === 0 || !this.connected) return;
      try {
        const namesArr = Array.from(this.activeNames);
        const values = await invoke<Record<string, string>>(
          "read_signals_snapshot",
          { names: namesArr },
        );
        for (const listener of [...this.listeners]) {
          const subset: Record<string, string | null> = {};
          for (const name of listener.names) {
            subset[name] = values[name] ?? null;
          }
          listener.onChange(subset);
        }
      } catch {
        /* silent — keep polling */
      }
    }, 100);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
