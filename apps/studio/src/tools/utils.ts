/**
 * Shared utilities for Tool components.
 * Extracted from App.tsx to avoid duplication across tools.
 */
import type { EditorDiagnostic } from "../components/CodeEditor";

export interface PanelError {
  line: number;
  col: number;
  message: string;
  severity: "error" | "warning";
}

/** Parse compiler error output into structured PanelError objects. */
export function parseErrors(errorText: string): PanelError[] {
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

/** Convert PanelError[] to CodeMirror EditorDiagnostic[] (byte-offset based). */
export function toEditorDiagnostics(errors: PanelError[], source: string): EditorDiagnostic[] {
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
