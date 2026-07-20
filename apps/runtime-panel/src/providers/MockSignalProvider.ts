/**
 * MockSignalProvider — provides simulated, dynamically-changing signal values
 * for the Runtime Panel when no real Controller is connected.
 * Replaced by SignalBridge (IPC push/poll) when Controller is available.
 */

type TickListener = () => void;

export class MockSignalProvider {
  private values: Map<string, number>;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<TickListener> = new Set();

  constructor() {
    this.values = new Map([
      ["axis.0.pos", 100.0],
      ["axis.1.pos", 50.0],
      ["tank.level", 75.0],
      ["pump.0.speed", 1200],
      ["temp.reactor", 350.0],
      ["motor.current", 15.5],
      ["valve.position", 0.0],
    ]);
  }

  getValue(signal: string): number | null {
    return this.values.get(signal) ?? null;
  }
  /** Subscribe to value changes. Returns unsubscribe function. */
  onTick(listener: TickListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }


  getAllStrings(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, val] of this.values) {
      result[key] = val.toFixed(2);
    }
    return result;
  }

  /** Simulate dynamic changes — drift values slightly each tick */
  tick(): void {
    for (const [key, val] of this.values) {
      const drift = (Math.random() - 0.5) * 2; // ±1 drift
      this.values.set(key, Math.max(0, val + drift));
    }
    // Notify all listeners
    for (const fn of this.listeners) fn();
  }

  /** Start periodic ticking (every `intervalMs` ms) */
  start(intervalMs = 1000): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.tick(), intervalMs);
  }

  /** Stop ticking */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

/** Global singleton — shared across the Panel app */
export const mockSignals = new MockSignalProvider();
