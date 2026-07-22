// ModeSelector — Edit/Debug/Commissioning segmented control
// SDD §9: mode switching, emits mode:changed via ShellModeManager
import type { ShellMode } from "../core/ToolRegistry";

interface ModeSelectorProps {
  current: ShellMode;
  onChange: (mode: ShellMode) => void;
}

const MODES: { value: ShellMode; label: string }[] = [
  { value: "edit", label: "Edit" },
  { value: "debug", label: "Debug" },
  { value: "commissioning", label: "Commissioning" },
];

export default function ModeSelector({ current, onChange }: ModeSelectorProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        height: 28,
        padding: "0 12px",
        background: "var(--color-surface-1)",
        borderBottom: "1px solid var(--color-border)",
        flexShrink: 0,
      }}
    >
      {MODES.map((m) => (
        <button
          key={m.value}
          onClick={() => onChange(m.value)}
          style={{
            padding: "2px 16px",
            fontSize: 11,
            fontWeight: current === m.value ? 600 : 400,
            fontFamily: "var(--font-body)",
            background: "transparent",
            border: "none",
            borderBottom: current === m.value
              ? "2px solid var(--color-amber)"
              : "2px solid transparent",
            color: current === m.value
              ? "var(--color-text-primary)"
              : "var(--color-text-tertiary)",
            cursor: "pointer",
            transition: "color 100ms ease-out, border-color 100ms ease-out",
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
