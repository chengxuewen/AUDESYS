import { useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import CodeEditor, { type CodeEditorHandle, type EditorDiagnostic } from "./components/CodeEditor";
import FileOperations from "./components/FileOperations";
import DebugPanel from "./components/DebugPanel";
import SignalWatchPanel from "./components/SignalWatchPanel";
import ObservablePanel from "./components/ObservablePanel";
import ProjectTree from "./components/ProjectTree";
import StatusBar, { type CompileStatus } from "./components/StatusBar";
import ErrorPanel, { type PanelError } from "./components/ErrorPanel";
import "./App.css";

interface SignalState {
  name: string;
  value: unknown;
  pin_type: string;
}

const DEFAULT_SOURCE =
  "PROGRAM test\nVAR\n  x : INT;\n  y : INT;\nEND_VAR\nx := 42;\ny := x + 8;\nEND_PROGRAM";

/** Parse compiler error string into structured PanelError array. */
function parseErrors(errorText: string): PanelError[] {
  const errors: PanelError[] = [];

  // Pattern: "at line N, col M" or "at line N"
  const atLineCol = /at line\s+(\d+),\s+col\s+(\d+)/g;
  // Pattern: "redeclared at line N"
  const atLine = /at line\s+(\d+)/g;

  // Split by error separators
  const lines = errorText.split(/\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let lineNum = 1;
    let colNum = 1;

    // Try "at line N, col M" first
    const lcMatch = atLineCol.exec(trimmed);
    if (lcMatch) {
      lineNum = parseInt(lcMatch[1], 10) || 1;
      colNum = parseInt(lcMatch[2], 10) || 1;
    } else {
      // Try "at line N"
      const lMatch = atLine.exec(trimmed);
      if (lMatch) {
        lineNum = parseInt(lMatch[1], 10) || 1;
      }
    }

    // Reset regex state
    atLineCol.lastIndex = 0;
    atLine.lastIndex = 0;

    // Determine severity
    const isWarning = trimmed.includes("warning");
    const severity: "error" | "warning" = isWarning ? "warning" : "error";

    // Clean message: remove prefix like "lexer error: " or "parse error: "
    const message = trimmed.replace(/^(lexer|parse|codegen)\s+error:\s*/i, "");

    errors.push({ line: lineNum, col: colNum, message, severity });
  }

  return errors;
}

/** Convert PanelError to CodeMirror EditorDiagnostic (0-based positions). */
function toEditorDiagnostics(errors: PanelError[], source: string): EditorDiagnostic[] {
  const lines = source.split("\n");
  return errors.map((e) => {
    const lineIdx = Math.max(0, e.line - 1);
    const colIdx = Math.max(0, e.col - 1);
    let from = 0;
    for (let i = 0; i < lineIdx; i++) {
      from += (lines[i]?.length ?? 0) + 1;
    }
    from += colIdx;
    // ponytail: highlight to end of line for simplicity
    const to = from + (lines[lineIdx]?.length ?? 0) - colIdx;
    return { from, to: Math.max(from + 1, to), message: e.message, severity: e.severity };
  });
}

export default function App() {
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [signals, setSignals] = useState<SignalState[]>([]);
  const [compileStatus, setCompileStatus] = useState<CompileStatus>("ready");
  const [errors, setErrors] = useState<PanelError[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const editorRef = useRef<CodeEditorHandle>(null);

  const handleCompileRun = useCallback(async () => {
    setCompileStatus("compiling");
    setErrors([]);
    setSignals([]);

    try {
      const programJson: string = await invoke("compile_st", { source });
      const result: string = await invoke("run_program", {
        programJson,
        cycleMs: 10,
      });
      const states: SignalState[] = JSON.parse(result);
      setSignals(states);
      setCompileStatus("success");
    } catch (e) {
      const errStr = String(e);
      const parsedErrors = parseErrors(errStr);
      setErrors(parsedErrors);
      setCompileStatus("error");

      // Push diagnostics to editor
      const diags = toEditorDiagnostics(parsedErrors, source);
      editorRef.current?.setDiagnostics(diags);
    }
  }, [source]);

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
      const selected = await open({
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
        const selected = await save({
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
    for (let i = 0; i < lineIdx; i++) {
      pos += (lines[i]?.length ?? 0) + 1;
    }
    pos += Math.max(0, col - 1);
    editorRef.current.focusByPosition(pos);
  }, [source]);

  const handleCursorChange = useCallback((line: number, col: number) => {
    setCursorLine(line);
    setCursorCol(col);
  }, []);

  return (
    <div className="app-root">
      {/* Toolbar */}
      <div className="app-toolbar">
        <FileOperations
          currentFile={currentFile}
          onNew={handleNew}
          onOpen={handleOpen}
          onSave={handleSave}
        />
        <div className="app-toolbar__actions">
          <button
            className="app-btn"
            onClick={handleCompileRun}
            disabled={compileStatus === "compiling" || source.trim().length === 0}
          >
            {compileStatus === "compiling" ? "Compiling..." : "Compile & Run"}
          </button>
        </div>
      </div>

      <ProjectTree
        onFileOpen={(f) => { setSource(f.content); setCurrentFile(f.path); }}
        activeFile={currentFile}
      />


      {/* Main split pane */}
      <div className="app-main">
        <div className="app-panel app-panel--editor">
          <div className="app-panel__header">ST Source Editor</div>
          <CodeEditor
            ref={editorRef}
            value={source}
            onChange={setSource}
            onSave={handleSave}
            onCursorChange={handleCursorChange}
          />
        </div>

        <div className="app-panel app-panel--output">
          <div className="app-panel__header">Signal Output</div>
          {signals.length > 0 ? (
            <div className="app-signal-table-wrap">
              <table className="app-signal-table">
                <thead>
                  <tr>
                    <th className="app-signal-table__th">Signal Name</th>
                    <th className="app-signal-table__th">Value</th>
                    <th className="app-signal-table__th">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map((s, i) => (
                    <tr key={i} className="app-signal-table__tr">
                      <td className="app-signal-table__td">{s.name}</td>
                      <td className="app-signal-table__td app-signal-table__td--mono">
                        {JSON.stringify(s.value)}
                      </td>
                      <td className="app-signal-table__td app-signal-table__td--secondary">
                        {s.pin_type}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="app-panel__empty">
              {compileStatus === "compiling"
                ? "Compiling..."
                : "Compile an ST program to see signal output."}
            </div>
          )}
          <DebugPanel />
          <SignalWatchPanel />
          <ObservablePanel />
        </div>

      {/* Error Panel */}
      <ErrorPanel errors={errors} onErrorClick={handleErrorClick} />

      {/* Status Bar */}
      <StatusBar
        line={cursorLine}
        col={cursorCol}
        status={compileStatus}
        fileName={currentFile}
      />
    </div>
  );
}
