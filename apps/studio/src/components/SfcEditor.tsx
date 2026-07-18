import { useState, useRef, useCallback, useEffect } from "react";
import "./SfcEditor.css";

// ── Types ──
interface SfcAction {
  qualifier: string;
  body: string;
}

interface SfcStep {
  id: string;
  name: string;
  isInitial: boolean;
  actions: SfcAction[];
}

interface SfcTransition {
  id: string;
  from: string;
  to: string;
  condition: string;
}

type Selection =
  | { type: "step"; id: string }
  | { type: "transition"; id: string }
  | null;

// ── Id counter ──
let _idCounter = 0;
function nextId(prefix: string): string {
  _idCounter += 1;
  return `${prefix}-${_idCounter}`;
}

// ── Codegen ──
export function generateSfc(
  steps: SfcStep[],
  transitions: SfcTransition[],
): string {
  const lines: string[] = [];
  for (const step of steps) {
    lines.push(`STEP ${step.name}${step.isInitial ? " : INITIAL" : ""};`);
    for (const a of step.actions) {
      lines.push(`  ${a.qualifier}: ${a.body};`);
    }
    lines.push("END_STEP");
    lines.push("");
  }
  for (const t of transitions) {
    const fromStep = steps.find((s) => s.id === t.from);
    const toStep = steps.find((s) => s.id === t.to);
    const fromName = fromStep?.name ?? t.from;
    const toName = toStep?.name ?? t.to;
    lines.push(
      `TRANSITION FROM ${fromName} TO ${toName} : ${t.condition || "TRUE"};`,
    );
    lines.push("END_TRANSITION");
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}

// ── Component ──
export default function SfcEditor() {
  const [steps, setSteps] = useState<SfcStep[]>(() => [
    { id: nextId("step"), name: "Init", isInitial: true, actions: [] },
    { id: nextId("step"), name: "Step1", isInitial: false, actions: [] },
  ]);
  const [transitions, setTransitions] = useState<SfcTransition[]>([
    { id: nextId("trans"), from: "", to: "", condition: "TRUE" },
  ]);
  const [selection, setSelection] = useState<Selection>(null);
  const [editName, setEditName] = useState("");
  const [editCondition, setEditCondition] = useState("");
  const [editQualifier, setEditQualifier] = useState("N");
  const [editBody, setEditBody] = useState("");

  const canvasRef = useRef<HTMLDivElement>(null);
  const diagramRef = useRef<HTMLDivElement>(null);

  // Keep transitions synced with steps on init
  useEffect(() => {
    if (steps.length >= 2 && transitions.length === 1 && transitions[0].from === "") {
      setTransitions([
        { id: transitions[0].id, from: steps[0].id, to: steps[1].id, condition: "TRUE" },
      ]);
    }
    // ponytail: only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render connections (SVG lines) ──
  const renderConnections = useCallback(() => {
    if (!diagramRef.current) return null;
    const el = diagramRef.current;
    const lines: React.ReactNode[] = [];

    // ponytail: connection order = transitions array order

    for (const t of transitions) {
      const fromEl = el.querySelector(`[data-step="${t.from}"]`);
      const transEl = el.querySelector(`[data-trans="${t.id}"]`);
      const toEl = el.querySelector(`[data-step="${t.to}"]`);

      if (!fromEl || !transEl || !toEl) continue;

      const diagramRect = el.getBoundingClientRect();
      const fromRect = fromEl.getBoundingClientRect();
      const transRect = transEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      const x1 = fromRect.left - diagramRect.left + fromRect.width / 2;
      const y1 = fromRect.bottom - diagramRect.top;
      const x2 = transRect.left - diagramRect.left + transRect.width / 2;
      const y2 = transRect.top - diagramRect.top;
      const x3 = transRect.left - diagramRect.left + transRect.width / 2;
      const y3 = transRect.bottom - diagramRect.top;
      const x4 = toRect.left - diagramRect.left + toRect.width / 2;
      const y4 = toRect.top - diagramRect.top;

      lines.push(
        <g key={`conn-${t.id}`}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} />
          <line x1={x3} y1={y3} x2={x4} y2={y4} />
          {/* arrow on bottom line */}
          <polygon
            points={`${x4 - 4},${y4 - 6} ${x4 + 4},${y4 - 6} ${x4},${y4}`}
            fill="var(--color-text-tertiary)"
          />
        </g>,
      );
    }

    return lines;
  }, [steps, transitions]);

  // Force re-render connections on layout
  const [, setTick] = useState(0);
  useEffect(() => {
    const handle = requestAnimationFrame(() => setTick((t) => t + 1));
    return () => cancelAnimationFrame(handle);
  }, [steps, transitions]);

  // ── Handlers ──
  const handleSelectStep = useCallback(
    (step: SfcStep) => {
      setSelection({ type: "step", id: step.id });
      setEditName(step.name);
    },
    [],
  );

  const handleSelectTransition = useCallback(
    (t: SfcTransition) => {
      setSelection({ type: "transition", id: t.id });
      setEditCondition(t.condition);
    },
    [],
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === canvasRef.current || (e.target as HTMLElement).closest(".sfc-editor__diagram")) {
        setSelection(null);
      }
    },
    [],
  );

  const handleAddStep = useCallback(() => {
    const prevStep = steps[steps.length - 1];
    const newStepId = nextId("step");
    const newTransId = nextId("trans");
    setSteps((prev) => [
      ...prev,
      { id: newStepId, name: `Step${prev.length + 1}`, isInitial: false, actions: [] },
    ]);
    if (prevStep) {
      setTransitions((prev) => [
        ...prev,
        { id: newTransId, from: prevStep.id, to: newStepId, condition: "TRUE" },
      ]);
    }
  }, [steps]);

  const handleAddAction = useCallback(() => {
    if (!editQualifier.trim() || !editBody.trim()) return;
    setSelection((sel) => {
      if (sel?.type !== "step") return sel;
      setSteps((prev) =>
        prev.map((s) => {
          if (s.id !== sel.id) return s;
          return {
            ...s,
            actions: [
              ...s.actions,
              { qualifier: editQualifier.trim(), body: editBody.trim() },
            ],
          };
        }),
      );
      return sel;
    });
    setEditBody("");
  }, [editQualifier, editBody]);

  const handleRemoveAction = useCallback((index: number) => {
    setSelection((sel) => {
      if (sel?.type !== "step") return sel;
      setSteps((prev) =>
        prev.map((s) => {
          if (s.id !== sel.id) return s;
          return {
            ...s,
            actions: s.actions.filter((_, i) => i !== index),
          };
        }),
      );
      return sel;
    });
  }, []);

  const handleSaveStepName = useCallback(() => {
    setSelection((sel) => {
      if (sel?.type !== "step") return sel;
      setSteps((prev) =>
        prev.map((s) => {
          if (s.id !== sel.id) return s;
          return { ...s, name: editName || s.name };
        }),
      );
      return sel;
    });
  }, [editName]);

  const handleSaveCondition = useCallback(() => {
    setSelection((sel) => {
      if (sel?.type !== "transition") return sel;
      setTransitions((prev) =>
        prev.map((t) => {
          if (t.id !== sel.id) return t;
          return { ...t, condition: editCondition };
        }),
      );
      return sel;
    });
  }, [editCondition]);

  const selectedStep = selection?.type === "step"
    ? steps.find((s) => s.id === selection.id) ?? null
    : null;
  const selectedTransition = selection?.type === "transition"
    ? transitions.find((t) => t.id === selection.id) ?? null
    : null;

  return (
    <div className="sfc-editor">
      {/* Toolbar */}
      <div className="sfc-editor__toolbar">
        <button className="sfc-editor__toolbar-btn" onClick={handleAddStep}>
          + Step
        </button>
        <button
          className="sfc-editor__toolbar-btn sfc-editor__toolbar-btn--secondary"
          onClick={() => {
            const code = generateSfc(steps, transitions);
            navigator.clipboard.writeText(code).catch(() => {});
          }}
        >
          Copy SFC
        </button>
      </div>

      {/* Canvas + Editor split */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Diagram Canvas */}
        <div
          ref={canvasRef}
          className="sfc-editor__canvas"
          onClick={handleCanvasClick}
        >
          <div ref={diagramRef} className="sfc-editor__diagram">
            {/* SVG overlay for connections */}
            <svg className="sfc-editor__connections">
              {renderConnections()}
            </svg>

            {/* Steps & Transitions interleaved */}
            {steps.map((step, i) => (
              <div key={step.id}>
                {/* Step */}
                <div
                  className="sfc-step"
                  data-step={step.id}
                  onDoubleClick={() => handleSelectStep(step)}
                >
                  <div
                    className={[
                      "sfc-step__box",
                      step.isInitial ? "sfc-step__box--initial" : "",
                      selection?.type === "step" && selection.id === step.id
                        ? "sfc-step__box--selected"
                        : "",
                    ].join(" ")}
                    onClick={() => handleSelectStep(step)}
                  >
                    <div className="sfc-step__name">
                      {step.name}
                      {step.isInitial && (
                        <span className="sfc-step__badge">INIT</span>
                      )}
                    </div>
                    {step.actions.length > 0 ? (
                      step.actions.map((a, j) => (
                        <div className="sfc-step__action" key={j}>
                          <span className="sfc-step__action-qual">{a.qualifier}</span>
                          <span>{a.body}</span>
                        </div>
                      ))
                    ) : (
                      <div className="sfc-step__empty">no actions</div>
                    )}
                  </div>
                </div>

                {/* Transition after every step except the last */}
                {i < transitions.length && transitions[i] && (
                  <>
                    <div className="sfc-step-gap" />
                    <div
                      className="sfc-transition"
                      data-trans={transitions[i].id}
                    >
                      <div
                        className={[
                          "sfc-transition__bar",
                          selection?.type === "transition" &&
                          selection.id === transitions[i].id
                            ? "sfc-transition__bar--selected"
                            : "",
                        ].join(" ")}
                        onClick={() => handleSelectTransition(transitions[i])}
                      >
                        <span
                          className={[
                            "sfc-transition__condition",
                            !transitions[i].condition
                              ? "sfc-transition__condition--empty"
                              : "",
                          ].join(" ")}
                        >
                          {transitions[i].condition || "no condition"}
                        </span>
                      </div>
                    </div>
                    <div className="sfc-trans-gap" />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Property Editor Sidebar */}
        <div
          style={{
            width: 280,
            borderLeft: "1px solid var(--color-border)",
            background: "var(--color-surface-1)",
            overflowY: "auto",
            flexShrink: 0,
          }}
        >
          <div className="app-panel__header">Properties</div>

          {!selection && (
            <div className="app-panel__empty" style={{ padding: 16 }}>
              Click a step or transition to edit
            </div>
          )}

          {/* Step Editor */}
          {selectedStep && (
            <div style={{ padding: 12 }}>
              <div className="sfc-editor__form">
                <label className="sfc-editor__label">Name</label>
                <div className="sfc-editor__form-row">
                  <input
                    className="sfc-editor__input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleSaveStepName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveStepName();
                    }}
                  />
                </div>

                <label className="sfc-editor__label" style={{ marginTop: 8 }}>
                  Actions
                </label>
                {selectedStep.actions.map((a, i) => (
                  <div key={i} className="sfc-editor__form-row">
                    <span
                      className="sfc-editor__input sfc-editor__input--qual"
                      style={{ background: "transparent", border: "none" }}
                    >
                      {a.qualifier}
                    </span>
                    <span
                      className="sfc-editor__input"
                      style={{ background: "transparent", border: "none" }}
                    >
                      {a.body}
                    </span>
                    <button
                      className="sfc-editor__btn-sm sfc-editor__btn-sm--del"
                      onClick={() => handleRemoveAction(i)}
                    >
                      ×
                    </button>
                  </div>
                ))}

                <div className="sfc-editor__form-row" style={{ marginTop: 4 }}>
                  <input
                    className="sfc-editor__input sfc-editor__input--qual"
                    placeholder="N"
                    value={editQualifier}
                    onChange={(e) => setEditQualifier(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddAction();
                    }}
                  />
                  <input
                    className="sfc-editor__input sfc-editor__input--body"
                    placeholder="action body"
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddAction();
                    }}
                  />
                  <button
                    className="sfc-editor__btn-sm"
                    onClick={handleAddAction}
                    disabled={!editQualifier.trim() || !editBody.trim()}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Transition Editor */}
          {selectedTransition && (
            <div style={{ padding: 12 }}>
              <div className="sfc-editor__form">
                <label className="sfc-editor__label">From</label>
                <div className="sfc-editor__form-row">
                  <span className="sfc-editor__input" style={{ background: "transparent", border: "none" }}>
                    {steps.find((s) => s.id === selectedTransition.from)?.name ?? "—"}
                  </span>
                </div>
                <label className="sfc-editor__label">To</label>
                <div className="sfc-editor__form-row">
                  <span className="sfc-editor__input" style={{ background: "transparent", border: "none" }}>
                    {steps.find((s) => s.id === selectedTransition.to)?.name ?? "—"}
                  </span>
                </div>
                <label className="sfc-editor__label">Condition</label>
                <div className="sfc-editor__form-row">
                  <input
                    className="sfc-editor__input"
                    value={editCondition}
                    onChange={(e) => setEditCondition(e.target.value)}
                    onBlur={handleSaveCondition}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveCondition();
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
