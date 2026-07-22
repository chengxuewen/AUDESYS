import { useHmiSignal, type HmiSignalResult } from "../../../../packages/studio-core/src/hooks/useHmiSignal";
import { usePlatform } from "../platform/provider";

/**
 * Studio-specific HMI signal hook.
 * Uses the platform adapter's invoke() to call `controller_read_signal` via Tauri IPC.
 */
export function useStudioHmiSignal(signalName?: string): HmiSignalResult {
  const platform = usePlatform();
  const invoker = (name: string) =>
    platform.invoke("controller_read_signal", { signalName: name });
  return useHmiSignal(signalName, invoker);
}
