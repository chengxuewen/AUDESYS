import { useHmiSignal, type HmiSignalResult } from "../../../../packages/studio-core/src/hooks/useHmiSignal";
import { invoke } from "@tauri-apps/api/core";

/**
 * Runtime Panel IPC-based HMI signal hook.
 * Uses Tauri invoke to call `read_signal` against the connected Controller.
 */
export function useIpcHmiSignal(signalName?: string): HmiSignalResult {
  const invoker = (name: string) => invoke("read_signal", { name });
  return useHmiSignal(signalName, invoker);
}
