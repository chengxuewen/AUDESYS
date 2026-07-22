/**
 * SimulatorTool — Simulation harness controls.
 * Wraps SimulatorPanel (Signals, Devices, Modbus, Scene, Faults tabs).
 * Fully self-contained — SimulatorPanel already manages its own state.
 */
import SimulatorPanel from "../components/SimulatorPanel";
import type { ToolProps, ToolDescriptor } from "./types";

export default function SimulatorTool(_props: ToolProps) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <SimulatorPanel />
    </div>
  );
}

export const descriptor: ToolDescriptor = {
  id: "audesys.simulator",
  label: "Simulator",
  icon: "play",
  group: "monitor",
  component: SimulatorTool,
};
