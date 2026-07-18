import { useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import CodeEditor, { type CodeEditorHandle, type EditorDiagnostic } from "./components/CodeEditor";
import LdEditor from "./components/LdEditor";
import FileOperations from "./components/FileOperations";
import DebugPanel from "./components/DebugPanel";
import SignalWatchPanel from "./components/SignalWatchPanel";
import ObservablePanel from "./components/ObservablePanel";
import ProjectTree from "./components/ProjectTree";
import StatusBar, { type CompileStatus } from "./components/StatusBar";
import ErrorPanel, { type PanelError } from "./components/ErrorPanel";
import "./App.css";
import FbdEditor from "./components/FbdEditor";
import SfcEditor from "./components/SfcEditor";
import SimulatorPanel from "./components/SimulatorPanel";

interface SignalState {
  name: string;
  value: unknown;
  pin_type: string;
}

const DEFAULT_SOURCE =
  "PROGRAM test\nVAR\n  x : INT;\n  y : INT;\nEND_VAR\nx := 42;\ny := x + 8;\nEND_PROGRAM";
const DEFAULT_IL = "LD 42\nST x";
const DEFAULT_LD = "NETWORK 1\nNO 1\nOUT 2\nEND_NETWORK";

function parseErrors(errorText: string): PanelError[] {
  const errors: PanelError[] = [];
  const atLineCol = /at line\s+(\d+),\s+col\s+(\d+)/g;
  const atLine = /at line\s+(\d+)/g;
  const lines = errorText.split(/\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let lineNum = 1;
    let colNum = 1;

    const lcMatch = atLineCol.exec(trimmed);
    if (lcMatch) {
      lineNum = parseInt(lcMatch[1], 10) || 1;
      colNum = parseInt(lcMatch[2], 10) || 1;
    } else {
      const lMatch = atLine.exec(trimmed);
      if (lMatch) {
        lineNum = parseInt(lMatch[1], 10) || 1;
      }
    }

    atLineCol.lastIndex = 0;
    atLine.lastIndex = 0;

    const isWarning = trimmed.includes("warning");
    const severity: "error" | "warning" = isWarning ? "warning" : "error";
    const message = trimmed.replace(/^(lexer|parse|codegen)\s+error:\s*/i, "");
    errors.push({ line: lineNum, col: colNum, message, severity });
  }
  return errors;
}

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
  const [langMode, setLangMode] = useState<"st" | "il" | "ld" | "fbd" | "sfc">("st");
  const [fbdText, setFbdText] = useState("");
  const editorRef = useRef<CodeEditorHandle>(null);

  const handleCompileRun = useCallback(async () => {
    setCompileStatus("compiling");
    setErrors([]);
    setSignals([]);

    try {
      const programJson: string = langMode === "fbd"
        ? await invoke("compile_st", { source: fbdText })
        : langMode === "st"
        ? await invoke("compile_st", { source })
        : langMode === "ld"
        ? await invoke("compile_ld", { source })
        : await invoke("compile_il", { source });
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

      const diags = toEditorDiagnostics(parsedErrors, langMode === "fbd" ? fbdText : source);
      editorRef.current?.setDiagnostics(diags);
    }
  }, [source, langMode, fbdText]);

  const handleNew = useCallback(() => {
    const defaults: Record<string, string> = {
      st: "",
      il: DEFAULT_IL,
      ld: DEFAULT_LD,
      fbd: "",
      sfc: "",
    };
    setSource(defaults[langMode]);
    setCurrentFile(null);
    setErrors([]);
    setSignals([]);
    setCompileStatus("ready");
    editorRef.current?.setDiagnostics([]);
  }, [langMode]);

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

  const handleLdCompile = useCallback((ldText: string) => {
    setSource(ldText);
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
          <button
            className="app-btn"
            onClick={() => setLangMode((l) => (l === "st" ? "il" : l === "il" ? "ld" : l === "ld" ? "fbd" : l === "fbd" ? "sfc" : "st"))}
            style={{ marginLeft: "8px", fontSize: "12px", fontFamily: "monospace" }}
          >
            {langMode.toUpperCase()}
          </button>
        </div>
      </div>

      <ProjectTree
        onFileOpen={(f) => { setSource(f.content); setCurrentFile(f.path); }}
        activeFile={currentFile}
      />

      {/* Main split pane */}
      <div className="app-main">
        {langMode === "sfc" ? (
          <div className="app-panel app-panel--editor">
            <div className="app-panel__header">SFC Editor</div>
            <SfcEditor />
          </div>
        ) : langMode === "fbd" ? (
          <div className="app-panel app-panel--editor">
            <div className="app-panel__header">FBD Editor</div>
            <FbdEditor onFbdChange={setFbdText} />
          </div>
        ) : langMode === "ld" ? (
          <div className="app-panel app-panel--editor">
            <div className="app-panel__header">LD Editor</div>
            <LdEditor onCompile={handleLdCompile} />
          </div>
        ) : (
          <div className="app-panel app-panel--editor">
            <div className="app-panel__header">
              {langMode === "st" ? "ST Source Editor" : "IL Source Editor"}
            </div>
            <CodeEditor
              ref={editorRef}
              value={source}
              onChange={setSource}
              onSave={handleSave}
              onCursorChange={handleCursorChange}
            />
          </div>
        )}

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
          <SimulatorPanel />
        </div>
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
