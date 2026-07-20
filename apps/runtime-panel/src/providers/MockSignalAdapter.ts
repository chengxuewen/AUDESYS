import type { ISignalProvider } from "./ISignalProvider";
import { mockSignals } from "./MockSignalProvider";

/**
 * MockSignalAdapter — wraps the existing MockSignalProvider singleton
 * to conform to the ISignalProvider interface.
 * Used as the default provider for P1 Panel development.
 */
export class MockSignalAdapter implements ISignalProvider {
  private connected = false;

  async connect(): Promise<void> {
    if (this.connected) return;
    mockSignals.start(1000);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    mockSignals.stop();
    this.connected = false;
  }

  async readSignal(name: string): Promise<string | null> {
    const val = mockSignals.getValue(name);
    return val !== null ? val.toFixed(2) : null;
  }

  subscribeSignals(
    names: string[],
    onChange: (signals: Record<string, string | null>) => void,
  ): () => void {
    const nameSet = new Set(names);
    return mockSignals.onTick(() => {
      const snapshot: Record<string, string | null> = {};
      for (const name of nameSet) {
        const val = mockSignals.getValue(name);
        snapshot[name] = val !== null ? val.toFixed(2) : null;
      }
      onChange(snapshot);
    });
  }
}
