/**
 * StCompilerTool — ST (Structured Text) code editor with compile & run.
 * Extracted from App.tsx. Self-contained state management.
 */
import { useState, useRef, useCallback } from "react";
import { usePlatform } from "../platform/provider";
import CodeEditor, { type CodeEditorHandle } from "../components/CodeEditor";
import type { ToolProps, ToolDescriptor } from "./types";
import { parseErrors, toEditorDiagnostics, type PanelError } from "./utils";

const DEFAULT_SOURCE =
  "PROGRAM test\nVAR\n  x : INT;\n  y : INT;\nEND_VAR\nx := 42;\ny := x + 8;\nEND_PROGRAM";

interface SignalState {
  name: string;
  value: unknown;
  pin_type: string;
}

type CompileStatus = "ready" | "compiling" | "success" | "error";

export default function StCompilerTool({ toolId, eventBus }: ToolProps) {
  // ponytail: narrow eventBus from unknown (ToolRegistry placeholder)
  const eb = eventBus as Record<string, (...args: unknown[]) => void>;
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [signals, setSignals] = useState<SignalState[]>([]);
  const [compileStatus, setCompileStatus] = useState<CompileStatus>("ready");
  const [errors, setErrors] = useState<PanelError[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const editorRef = useRef<CodeEditorHandle>(null);
  const { invoke, readTextFile, writeTextFile, openFileDialog, saveFileDialog } = usePlatform();

  const handleCompileRun = useCallback(async () => {
    setCompileStatus("compiling");
    setErrors([]);
    setSignals([]);
    try {
      const programJson: string = await invoke("compile_st", { source });
      const result: string = await invoke("run_program", { programJson, cycleMs: 10 });
      const states: SignalState[] = JSON.parse(result);
      setSignals(states);
      setCompileStatus("success");
      eb?.emit("signal-change", { toolId, signals: states });
    } catch (e) {
      const errStr = String(e);
      const parsedErrors = parseErrors(errStr);
      setErrors(parsedErrors);
      setCompileStatus("error");
      const diags = toEditorDiagnostics(parsedErrors, source);
      editorRef.current?.setDiagnostics(diags);
    }
  }, [source, toolId, eventBus]);

  const handleNew = useCallback(() => {
    setSource("");
    setCurrentFile(null);
    setErrors([]);
    setSignals([]);
    setCompileStatus("ready");
    editorRef.current?.setDiagnostics([]);
  }, []);

  const handleOpen = useCallback(async () => {
    try {
      const selected = await openFileDialog({
        title: "Open ST Source File",
        filters: [{ name: "Structured Text", extensions: ["st", "ST", "txt"] }],
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        const content = await readTextFile(selected);
        setSource(content);
        setCurrentFile(selected);
        setErrors([]);
        setSignals([]);
        setCompileStatus("ready");
        editorRef.current?.setDiagnostics([]);
      }
    } catch (e) {
      const msg = String(e);
      if (!msg.includes("cancelled") && !msg.includes("canceled")) {
        setErrors([{ line: 1, col: 1, message: `Failed to open file: ${msg}`, severity: "error" }]);
      }
    }
  }, []);

  const handleSave = useCallback(async () => {
    try {
      if (currentFile) {
        await writeTextFile(currentFile, source);
        setCompileStatus("ready");
      } else {
        const selected = await saveFileDialog({
          title: "Save ST Source File",
          filters: [{ name: "Structured Text", extensions: ["st"] }],
        });
        if (selected) {
          await writeTextFile(selected, source);
          setCurrentFile(selected);
          setCompileStatus("ready");
        }
      }
    } catch (e) {
      const msg = String(e);
      if (!msg.includes("cancelled") && !msg.includes("canceled")) {
        setErrors([{ line: 1, col: 1, message: `Failed to save file: ${msg}`, severity: "error" }]);
      }
    }
  }, [source, currentFile]);

  const handleErrorClick = useCallback((line: number, col: number) => {
    if (!editorRef.current) return;
    const lines = source.split("\n");
    const lineIdx = Math.max(0, line - 1);
    let pos = 0;
    for (let i = 0; i < lineIdx; i++) pos += (lines[i]?.length ?? 0) + 1;
    pos += Math.max(0, col - 1);
    editorRef.current.focusByPosition(pos);
  }, [source]);

  const handleCursorChange = useCallback((line: number, col: number) => {
    setCursorLine(line);
    setCursorCol(col);
  }, []);

  const shortName = currentFile ? currentFile.split("/").pop() ?? currentFile : null;
  const isCompiling = compileStatus === "compiling";
  const canCompile = !isCompiling && source.trim().length > 0;

  return (
    <div className="app-panel app-panel--editor">
      <div className="app-panel__header">ST Source Editor</div>
      <div style={{ display: "flex", alignItems: "center", padding: "4px 12px", gap: 8, background: "var(--color-surface-2)", borderBottom: "1px solid var(--color-border)" }}>
        <button className="app-btn" style={{ fontSize: 12, padding: "2px 10px" }} onClick={handleNew}>New</button>
        <button className="app-btn" style={{ fontSize: 12, padding: "2px 10px" }} onClick={handleOpen}>Open</button>
        <button className="app-btn" style={{ fontSize: 12, padding: "2px 10px" }} onClick={handleSave}>Save</button>
        <button className="app-btn" onClick={handleCompileRun} disabled={!canCompile} style={{ fontSize: 12, padding: "2px 10px", marginLeft: "auto" }}>
          {isCompiling ? "Compiling..." : "Compile & Run"}
        </button>
      </div>
      <CodeEditor
        ref={editorRef}
        value={source}
        onChange={setSource}
        onSave={handleSave}
        onCursorChange={handleCursorChange}
      />
      <div style={{ borderTop: "1px solid var(--color-border)", padding: 4, fontSize: 11, color: "var(--color-text-tertiary)", display: "flex", justifyContent: "space-between" }}>
        <span>{shortName ?? "untitled.st"} | Ln {cursorLine}, Col {cursorCol}</span>
        <span>{compileStatus === "success" ? "\u2713 OK" : compileStatus === "error" ? "\u2717 Error" : isCompiling ? "..." : "Ready"}</span>
      </div>
      {errors.length > 0 && (
        <div style={{ maxHeight: 100, overflow: "auto", borderTop: "1px solid var(--color-border)", fontSize: 12 }}>
          {errors.map((e, i) => (
            <div
              key={i}
              style={{ padding: "2px 12px", cursor: "pointer", color: e.severity === "error" ? "var(--color-error)" : "var(--color-warning)" }}
              onClick={() => handleErrorClick(e.line, e.col)}
            >
              Ln {e.line}:{e.col} — {e.message}
            </div>
          ))}
        </div>
      )}
      {signals.length > 0 && (
        <div style={{ maxHeight: 120, overflow: "auto", borderTop: "1px solid var(--color-border)" }}>
          <table className="app-signal-table" style={{ width: "100%" }}>
            <thead><tr>
              <th className="app-signal-table__th">Signal</th>
              <th className="app-signal-table__th">Value</th>
              <th className="app-signal-table__th">Type</th>
            </tr></thead>
            <tbody>
              {signals.map((s, i) => (
                <tr key={i} className="app-signal-table__tr">
                  <td className="app-signal-table__td">{s.name}</td>
                  <td className="app-signal-table__td app-signal-table__td--mono">{JSON.stringify(s.value)}</td>
                  <td className="app-signal-table__td app-signal-table__td--secondary">{s.pin_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const descriptor: ToolDescriptor = {
  id: "audesys.st-compiler",
  label: "ST Compiler",
  icon: "code",
  group: "editor",
  component: StCompilerTool,
};
