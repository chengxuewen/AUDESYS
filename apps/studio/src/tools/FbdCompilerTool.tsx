/**
 * FbdCompilerTool — FBD (Function Block Diagram) graphical editor.
 * Wraps FbdEditor with tool protocol. Self-contained.
 */
import { useCallback } from "react";
import FbdEditor from "../components/FbdEditor";
import type { ToolProps, ToolDescriptor } from "./types";

export default function FbdCompilerTool({ toolId, eventBus }: ToolProps) {
  // ponytail: narrow eventBus from unknown (ToolRegistry placeholder)
  const eb = eventBus as Record<string, (...args: unknown[]) => void>;
  const handleFbdChange = useCallback((text: string) => {
    eb?.emit("fbd-change", { toolId, fbdText: text });
    eb?.emit("fbd-change", { toolId, fbdText: text });
  }, [toolId, eventBus]);

  return (
    <div className="app-panel app-panel--editor" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div className="app-panel__header">FBD Editor</div>
      <FbdEditor onFbdChange={handleFbdChange} />
    </div>
  );
}

export const descriptor: ToolDescriptor = {
  id: "audesys.fbd-compiler",
  label: "FBD Compiler",
  icon: "blocks",
  group: "editor",
  component: FbdCompilerTool,
};
