import { forwardRef, useRef, useEffect, useImperativeHandle } from "react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
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
} from "@codemirror/language";
import { closeBrackets } from "@codemirror/autocomplete";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import "./CodeEditor.css";

export interface EditorDiagnostic {
  from: number;
  to: number;
  message: string;
  severity: "error" | "warning";
}

export interface CodeEditorHandle {
  setDiagnostics(diags: EditorDiagnostic[]): void;
  focusByPosition(pos: number): void;
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  onCursorChange?: (line: number, col: number) => void;
}

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(
  ({ value, onChange, onSave, onCursorChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const externalUpdate = useRef(false);

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
          foldGutter(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          bracketMatching(),
          closeBrackets(),
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
          cpp(),
          oneDark,
          lintGutter(),
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
