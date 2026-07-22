// NavBar — vertical icon bar (48px) with tool group separators and mode filtering
// SDD §1: left-side navigation, activates tools, debug mode hides monitor group
import type { ToolDescriptor, ShellMode } from "../core/ToolRegistry";
import "./NavBar.css";

interface NavBarProps {
  tools: ToolDescriptor[];
  activeId: string | null;
  mode: ShellMode;
  onActivate: (id: string) => void;
}

const GROUP_ORDER: ToolDescriptor["group"][] = ["editor", "config", "monitor"];

const GROUP_LABELS: Record<ToolDescriptor["group"], string> = {
  editor: "Code",
  config: "HMI",
  monitor: "Monitor",
};

export default function NavBar({ tools, activeId, mode, onActivate }: NavBarProps) {
  const grouped = new Map<ToolDescriptor["group"], ToolDescriptor[]>();
  for (const t of tools) {
    // Debug mode hides monitor group
    if (mode === "debug" && t.group === "monitor") continue;
    const list = grouped.get(t.group);
    if (list) list.push(t);
    else grouped.set(t.group, [t]);
  }

  return (
    <nav className="shell-navbar">
      {GROUP_ORDER.map((group) => {
        const groupTools = grouped.get(group);
        if (!groupTools || groupTools.length === 0) return null;
        return (
          <div className="shell-navbar__group" key={group}>
            <span className="shell-navbar__label">
              {GROUP_LABELS[group]}
            </span>
            {groupTools.map((tool) => (
              <button
                className={`shell-navbar__btn${activeId === tool.id ? " shell-navbar__btn--active" : ""}`}
                key={tool.id}
                onClick={() => onActivate(tool.id)}
              >
                <NavIcon icon={tool.icon} />
              </button>
            ))}
            {/* ponytail: simple hr separator between groups */}
            {group !== GROUP_ORDER[GROUP_ORDER.length - 1] && (
              <div className="shell-navbar__separator" />
            )}
          </div>
        );
      })}
    </nav>
  );
}

/** Minimal icon mapping — ponytail: unicode symbols, replace with icon library when needed */
function NavIcon({ icon }: { icon: string }) {
  const map: Record<string, string> = {
    code: "\u27E8\u27E9",       // ⟨⟩
    layout: "\u25A6",            // ▦
    play: "\u25B6",              // ▶
    monitor: "\u231A",           // ⌚
  };
  return <span>{map[icon] ?? "\u25CF"}</span>;
}
