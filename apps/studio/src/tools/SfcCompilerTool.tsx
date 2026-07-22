/**
 * SfcCompilerTool — SFC (Sequential Function Chart) graphical editor.
 * Wraps SfcEditor with tool protocol. Self-contained.
 */
import SfcEditor from "../components/SfcEditor";
import type { ToolProps, ToolDescriptor } from "./types";

export default function SfcCompilerTool(_props: ToolProps) {
  return (
    <div className="app-panel app-panel--editor" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div className="app-panel__header">SFC Editor</div>
      <SfcEditor />
    </div>
  );
}

export const descriptor: ToolDescriptor = {
  id: "audesys.sfc-compiler",
  label: "SFC Compiler",
  icon: "flowchart",
  group: "editor",
  component: SfcCompilerTool,
};
