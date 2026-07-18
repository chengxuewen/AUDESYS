import { forwardRef, useRef, useEffect, useImperativeHandle } from "react";
import { EditorState, StateField, StateEffect } from "@codemirror/state";
import {
  EditorView,
  gutter,
  GutterMarker,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { cpp } from "@codemirror/lang-cpp";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  lintGutter,
  setDiagnostics as cmSetDiagnostics,
  type Diagnostic,
} from "@codemirror/lint";
import {
  bracketMatching,
  syntaxHighlighting,
  defaultHighlightStyle,
  foldGutter,
  indentOnInput,
  StreamLanguage,
} from "@codemirror/language";
import { closeBrackets, autocompletion, type CompletionContext } from "@codemirror/autocomplete";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import "./CodeEditor.css";

// ── Breakpoint gutter ──
class BreakpointMarker extends GutterMarker {
  toDOM() {
    const dot = document.createElement("div");
    dot.className = "cm-breakpoint-dot";
    return dot;
  }
}

const toggleBreakpointEffect = StateEffect.define<{ line: number }>();

const breakpointField = StateField.define<Set<number>>({
  create() {
    return new Set();
  },
  update(set, tr) {
    for (const e of tr.effects) {
      if (e.is(toggleBreakpointEffect)) {
        const next = new Set(set);
        if (next.has(e.value.line)) {
          next.delete(e.value.line);
        } else {
          next.add(e.value.line);
        }
        return next;
      }
    }
    return set;
  },
});


// ── IEC 61131-3 keyword completions ──
const ST_KEYWORDS = [
  "PROGRAM", "END_PROGRAM", "VAR", "END_VAR",
  "IF", "THEN", "ELSE", "END_IF",
  "TON", "TOF", "TP", "CTU", "CTD", "CTUD",
  "SR", "RS", "R_TRIG", "F_TRIG",
  "INT", "BOOL", "REAL", "DINT", "BYTE", "WORD", "SINT", "USINT", "UINT", "STRING",
  "CASE", "OF", "END_CASE",
  "FOR", "TO", "BY", "END_FOR",
  "WHILE", "DO", "END_WHILE",
  "REPEAT", "UNTIL", "END_REPEAT",
  "RETURN", "EXIT",
  "TRUE", "FALSE",
  "AND", "OR", "XOR", "NOT", "MOD",
];

const IL_KEYWORDS = [
  "LD", "ST", "AND", "OR", "XOR", "NOT",
  "ADD", "SUB", "MUL", "DIV", "MOD",
  "GT", "GE", "EQ", "NE", "LE", "LT",
  "JMP", "JMPC", "JMPCN", "CAL", "RET",
];

const LD_KEYWORDS = [
  "NETWORK", "END_NETWORK",
  "NO", "NC", "OUT", "SET", "RESET",
];
// ── IL stream parser ─────────────────────────────────
const ilLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/\(\*[\s\S]*?\*\)/)) return "blockComment";
    if (stream.match(/\/\/.*/)) return "lineComment";
    if (stream.match(/[0-9]+(\.[0-9]+)?/)) return "number";
    const word = stream.match(/[A-Za-z_]\w*/);
    if (word) {
      if (IL_KEYWORDS.some(k => k === word[0].toUpperCase())) return "keyword";
    }
    stream.next();
    return null;
  },
});

// ── LD stream parser ─────────────────────────────────
const ldLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/\(\*[\s\S]*?\*\)/)) return "blockComment";
    if (stream.match(/\/\/.*/)) return "lineComment";
    if (stream.match(/[0-9]+(\.[0-9]+)?/)) return "number";
    const word = stream.match(/[A-Za-z_]\w*/);
    if (word) {
      if (LD_KEYWORDS.some(k => k === word[0].toUpperCase())) return "keyword";
    }
    stream.next();
    return null;
  },
});

// All keywords, case-insensitive deduplicated
const ALL_KEYWORDS = [...new Set([...ST_KEYWORDS, ...IL_KEYWORDS, ...LD_KEYWORDS])];

function keywordCompletions(context: CompletionContext) {
  const word = context.matchBefore(/\w*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const prefix = word.text.toLowerCase();
  const options = ALL_KEYWORDS
    .filter((kw) => kw.toLowerCase().startsWith(prefix))
    .map((kw) => ({ label: kw, type: "keyword" as const }));
  return options.length ? { from: word.from, options, validFor: /^\w*$/ } : null;
}

// Scan VAR sections for declared variable names
function extractVarNames(source: string): string[] {
  const names: string[] = [];
  const blockRe = /VAR(?:_GLOBAL|_CONFIG|_EXTERNAL|_ACCESS|_INPUT|_OUTPUT|_IN_OUT|_TEMP)?[\s\S]*?END_VAR/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(source)) !== null) {
    const lines = match[0].split("\n");
    for (const line of lines) {
      const clean = line.replace(/AT\s+%[IQM][*BWDL].*/i, "").trim();
      const decl = clean.match(/^([\w\s,]+)\s*:/);
      if (decl) {
        const ids = decl[1].split(",").map((s) => s.trim()).filter(Boolean);
        names.push(...ids);
      }
    }
  }
  return [...new Set(names)];
}

function variableCompletions(context: CompletionContext) {
  const word = context.matchBefore(/\w*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const prefix = word.text.toLowerCase();
  const varNames = extractVarNames(context.state.doc.toString());
  const options = varNames
    .filter((n) => n.toLowerCase().startsWith(prefix))
    .map((n) => ({ label: n, type: "variable" as const }));
  return options.length ? { from: word.from, options, validFor: /^\w*$/ } : null;
}

export interface EditorDiagnostic {
  from: number;
  to: number;
  message: string;
  severity: "error" | "warning";
}

export interface CodeEditorHandle {
  setDiagnostics(diags: EditorDiagnostic[]): void;
  focusByPosition(pos: number): void;
  toggleBreakpoint(line: number): void;
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  onCursorChange?: (line: number, col: number) => void;
  /** IEC 61131-3 language mode. "st" (default) | "il" | "ld" */
  language?: "st" | "il" | "ld";
  onBreakpointToggle?: (line: number) => void;
}

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(
  ({ value, onChange, onSave, onCursorChange, language, onBreakpointToggle }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const externalUpdate = useRef(false);
    const onBpToggleRef = useRef(onBreakpointToggle);
    onBpToggleRef.current = onBreakpointToggle;

    useImperativeHandle(ref, () => ({
      setDiagnostics(diags: EditorDiagnostic[]) {
        if (!viewRef.current) return;
        const cmDiags: Diagnostic[] = diags.map((d) => ({
          from: d.from,
          to: d.to,
          message: d.message,
          severity: d.severity,
        }));
        viewRef.current.dispatch(
          cmSetDiagnostics(viewRef.current.state, cmDiags),
        );
      },
      focusByPosition(pos: number) {
        if (!viewRef.current) return;
        const view = viewRef.current;
        view.dispatch({
          selection: { anchor: pos, head: pos },
          scrollIntoView: true,
        });
        view.focus();
      },
      toggleBreakpoint(line: number) {
        if (!viewRef.current) return;
        viewRef.current.dispatch({
          effects: toggleBreakpointEffect.of({ line }),
        });
      },
    }));

    // Sync external value changes into the editor
    useEffect(() => {
      if (!viewRef.current) return;
      const view = viewRef.current;
      const currentDoc = view.state.doc.toString();
      if (value !== currentDoc) {
        externalUpdate.current = true;
        view.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: value },
        });
        externalUpdate.current = false;
      }
    }, [value]);

    // Create editor on mount
    useEffect(() => {
      if (!containerRef.current) return;

      const breakpointGutter = gutter({
        class: "cm-breakpoint-gutter",
        lineMarker(view, line) {
          if (view.state.field(breakpointField).has(line.number)) {
            return new BreakpointMarker();
          }
          return null;
        },
        domEventHandlers: {
          click(view, line) {
            const lineNum = view.state.doc.lineAt(line.from).number;
            onBpToggleRef.current?.(lineNum);
            view.dispatch({
              effects: toggleBreakpointEffect.of({ line: lineNum }),
            });
            return true;
          },
        },
      });

      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged && !externalUpdate.current) {
          onChange(update.state.doc.toString());
        }
        if (update.selectionSet && onCursorChange) {
          const pos = update.state.selection.main.head;
          const line = update.state.doc.lineAt(pos);
          onCursorChange(line.number, pos - line.from + 1);
        }
      });

      const saveKeymap = keymap.of([
        {
          key: "Mod-s",
          run: () => {
            onSave?.();
            return true;
          },
          preventDefault: true,
        },
      ]);

      const state = EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          breakpointField,
          foldGutter(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          bracketMatching(),
          closeBrackets(),
          autocompletion({ override: [keywordCompletions, variableCompletions] }),
          rectangularSelection(),
          crosshairCursor(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          keymap.of([
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            indentWithTab,
          ]),
          saveKeymap,
          language === "il" ? ilLanguage : language === "ld" ? ldLanguage : cpp(),
          oneDark,
          lintGutter(),
          breakpointGutter,
          updateListener,
          EditorView.theme({
            "&": { height: "100%" },
            ".cm-scroller": { overflow: "auto" },
          }),
        ],
      });

      const view = new EditorView({
        state,
        parent: containerRef.current,
      });

      viewRef.current = view;

      return () => {
        view.destroy();
        viewRef.current = null;
      };
      // Only mount once
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <div ref={containerRef} className="code-editor" />;
  },
);

CodeEditor.displayName = "CodeEditor";
export default CodeEditor;
