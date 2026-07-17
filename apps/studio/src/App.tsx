import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface SignalState {
  name: string;
  value: unknown;
  pin_type: string;
}


export default function App() {
  const [source, setSource] = useState(
    'PROGRAM test\nVAR\n  x : INT;\n  y : INT;\nEND_VAR\nx := 42;\ny := x + 8;\nEND_PROGRAM'
  );
  const [signals, setSignals] = useState<SignalState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCompileRun = async () => {
    setError(null);
    setSignals([]);
    setLoading(true);
    try {
      const programJson: string = await invoke("compile_st", { source });
      const result: string = await invoke("run_program", {
        programJson,
        cycleMs: 10,
      });
      const states: SignalState[] = JSON.parse(result);
      setSignals(states);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.root}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <span style={styles.title}>AUDESYS Studio</span>
        <button
          onClick={handleCompileRun}
          disabled={loading || source.trim().length === 0}
          style={{
            ...styles.btn,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Compiling..." : "Compile & Run"}
        </button>
      </div>

      {/* Main split pane */}
      <div style={styles.main}>
        {/* Left: ST Editor */}
        <div style={styles.panel}>
          <div style={styles.panelHeader}>ST Source Editor</div>
          <textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            spellCheck={false}
            style={styles.textarea}
          />
        </div>

        {/* Right: Signal Table */}
        <div style={styles.panel}>
          <div style={styles.panelHeader}>Signal Output</div>
          {error ? (
            <div style={styles.errorBanner}>{error}</div>
          ) : signals.length > 0 ? (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Signal Name</th>
                    <th style={styles.th}>Value</th>
                    <th style={styles.th}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map((s, i) => (
                    <tr key={i} style={styles.tr}>
                      <td style={styles.td}>{s.name}</td>
                      <td style={{ ...styles.td, fontFamily: "var(--font-mono)" }}>
                        {JSON.stringify(s.value)}
                      </td>
                      <td style={{ ...styles.td, color: "var(--color-text-secondary)" }}>
                        {s.pin_type}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={styles.empty}>Compile an ST program to see signal output.</div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "var(--color-canvas)",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 40,
    padding: "0 16px",
    background: "var(--color-surface-3)",
    borderBottom: "1px solid var(--color-border)",
    flexShrink: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--color-text-secondary)",
    letterSpacing: "0.5px",
  },
  btn: {
    padding: "4px 16px",
    background: "var(--color-amber)",
    color: "var(--color-canvas)",
    border: "none",
    borderRadius: "var(--radius-sm)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "var(--font-body)",
  },
  main: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  panel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid var(--color-border)",
    overflow: "hidden",
  },
  panelHeader: {
    height: 28,
    display: "flex",
    alignItems: "center",
    padding: "0 12px",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--color-text-tertiary)",
    background: "var(--color-surface-1)",
    borderBottom: "1px solid var(--color-border)",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  textarea: {
    flex: 1,
    background: "var(--color-surface-1)",
    color: "var(--color-text-primary)",
    border: "none",
    resize: "none",
    padding: 12,
    fontFamily: "var(--font-mono)",
    fontSize: 13,
    lineHeight: 1.6,
    outline: "none",
    tabSize: 2,
  },
  tableWrap: {
    flex: 1,
    overflow: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    position: "sticky",
    top: 0,
    background: "var(--color-surface-2)",
    color: "var(--color-text-secondary)",
    fontSize: 11,
    fontWeight: 600,
    textAlign: "left",
    padding: "6px 12px",
    borderBottom: "1px solid var(--color-border)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  tr: {
    borderBottom: "1px solid var(--color-border)",
  },
  td: {
    padding: "6px 12px",
    fontSize: 13,
    fontFamily: "var(--font-body)",
  },
  errorBanner: {
    padding: 12,
    margin: 12,
    background: "rgba(255, 68, 68, 0.1)",
    borderLeft: "3px solid var(--color-error)",
    color: "var(--color-error)",
    fontSize: 12,
    fontFamily: "var(--font-mono)",
    borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
    whiteSpace: "pre-wrap",
  },
  empty: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--color-text-tertiary)",
    fontSize: 13,
  },
};
