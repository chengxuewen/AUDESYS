// Toolbar — 40px global/mode/tool three-section action bar
// SDD §1: context-sensitive; actions from ShellMode + active Tool
import type { ToolbarAction } from "../core/ToolRegistry";
import "./Toolbar.css";

interface ToolbarProps {
  /** Global + mode-specific actions from ShellModeManager */
  shellActions: ToolbarAction[];
  /** Tool-specific actions from active tool descriptor */
  toolActions?: ToolbarAction[];
  /** File name or other status to show */
  status?: string;
}

export default function Toolbar({ shellActions, toolActions, status }: ToolbarProps) {
  const global = shellActions.filter((a) => a.section === "global");
  const mode = shellActions.filter((a) => a.section === "mode");
  const tool = toolActions ?? [];

  return (
    <div className="shell-toolbar">
      {/* Global section (save, open, compile) */}
      <div className="shell-toolbar__section">
        {global.map((a) => (
          <ToolbarButton key={a.id} action={a} />
        ))}
      </div>

      {/* Separator */}
      {(mode.length > 0 || tool.length > 0) && global.length > 0 && (
        <div className="shell-toolbar__separator" />
      )}

      {/* Mode section (debug: pause, step, resume | commissioning: deploy, snapshot) */}
      <div className="shell-toolbar__section">
        {mode.map((a) => (
          <ToolbarButton key={a.id} action={a} />
        ))}
      </div>

      {/* Separator */}
      {tool.length > 0 && mode.length > 0 && (
        <div className="shell-toolbar__separator" />
      )}

      {/* Tool section */}
      <div className="shell-toolbar__section">
        {tool.map((a) => (
          <ToolbarButton key={a.id} action={a} />
        ))}
      </div>

      {/* Status — pushed to right */}
      {status && (
        <div className="shell-toolbar__status">
          {status}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({ action }: { action: ToolbarAction }) {
  return (
    <button
      className="shell-toolbar__btn"
      title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
      onClick={() => action.handler(null)}
    >
      {action.icon && <span>{getIcon(action.icon)}</span>}
      <span className="shell-toolbar__btn-label">{action.label}</span>
    </button>
  );
}

function getIcon(icon: string): string {
  const map: Record<string, string> = {
    save: "\u2913",        // ⤓
    "folder-open": "\uD83D\uDCC2", // 📂
    play: "\u25B6",        // ▶
    pause: "\u23F8",       // ⏸
    "arrow-right": "\u2192", // →
    rocket: "\uD83D\uDE80", // 🚀
    camera: "\uD83D\uDCF7", // 📷
  };
  return map[icon] ?? "\u25CF";
}
