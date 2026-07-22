/**
 * LdCompilerTool — LD (Ladder Diagram) graphical editor.
 * Wraps LdEditor with tool protocol. Self-contained.
 */
import { useCallback } from "react";
import LdEditor from "../components/LdEditor";
import type { ToolProps, ToolDescriptor } from "./types";

export default function LdCompilerTool({ toolId, eventBus }: ToolProps) {
  // ponytail: narrow eventBus from unknown (ToolRegistry placeholder)
  const eb = eventBus as Record<string, (...args: unknown[]) => void>;
  const handleCompile = useCallback((text: string) => {
    eb?.emit("ld-change", { toolId, ldText: text });
    eb?.emit("ld-change", { toolId, ldText: text });
  }, [toolId, eventBus]);

  return (
    <div className="app-panel app-panel--editor" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div className="app-panel__header">LD Editor</div>
      <LdEditor onCompile={handleCompile} />
    </div>
  );
}

export const descriptor: ToolDescriptor = {
  id: "audesys.ld-compiler",
  label: "LD Compiler",
  icon: "diagram",
  group: "editor",
  component: LdCompilerTool,
};
