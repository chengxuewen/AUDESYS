/**
 * ISignalProvider — abstract interface for signal data sources.
 * Implementations: MockSignalAdapter (mock data), UdsSignalProvider (IPC push/poll), SimSignalProvider (SimulationHarness).
 */
export interface ISignalProvider {
  /** Initialize the provider — connect to data source, start periodic updates. */
  connect(): Promise<void>;

  /** Tear down the provider — disconnect, stop periodic updates. */
  disconnect(): Promise<void>;

  /** Read the current value of a single signal. Returns null if unknown. */
  readSignal(name: string): Promise<string | null>;

  /**
   * Subscribe to a set of signals. The `onChange` callback fires whenever any
   * subscribed signal value changes. Returns an unsubscribe function.
   */
  subscribeSignals(
    names: string[],
    onChange: (signals: Record<string, string | null>) => void,
  ): () => void;
}
