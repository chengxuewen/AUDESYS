import { useState } from "react";
import "./ErrorPanel.css";

export interface PanelError {
  line: number;
  col: number;
  message: string;
  severity: "error" | "warning";
}

interface ErrorPanelProps {
  errors: PanelError[];
  onErrorClick: (line: number, col: number) => void;
}

export default function ErrorPanel({ errors, onErrorClick }: ErrorPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const errorCount = errors.filter((e) => e.severity === "error").length;
  const warningCount = errors.filter((e) => e.severity === "warning").length;

  const headerLabel =
    errors.length === 0
      ? "No errors"
      : `${errors.length} issue${errors.length > 1 ? "s" : ""} (${errorCount} error${errorCount !== 1 ? "s" : ""}, ${warningCount} warning${warningCount !== 1 ? "s" : ""})`;

  return (
    <div className={`error-panel${collapsed ? " error-panel--collapsed" : ""}`}>
      <button
        className="error-panel__header"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? "Expand error panel" : "Collapse error panel"}
      >
        <span className="error-panel__chevron">
          {collapsed ? "\u25B6" : "\u25BC"}
        </span>
        <span
          className={`error-panel__label${errors.length > 0 ? " error-panel__label--has-errors" : ""}`}
        >
          {headerLabel}
        </span>
        {!collapsed && errors.length > 0 && (
          <span className="error-panel__counts">
            <span className="error-panel__count error-panel__count--error">
              {errorCount}
            </span>
            <span className="error-panel__count error-panel__count--warning">
              {warningCount}
            </span>
          </span>
        )}
      </button>
      {!collapsed && errors.length > 0 && (
        <div className="error-panel__list">
          {errors.map((err, i) => (
            <button
              key={i}
              className={`error-panel__item error-panel__item--${err.severity}`}
              onClick={() => onErrorClick(err.line, err.col)}
              title="Click to jump to location"
            >
              <span className="error-panel__item-location">
                Ln {err.line}, Col {err.col}
              </span>
              <span className="error-panel__item-message">{err.message}</span>
            </button>
          ))}
        </div>
      )}
      {!collapsed && errors.length === 0 && (
        <div className="error-panel__empty">No errors</div>
      )}
    </div>
  );
}
