// BottomSlot — tabbed panel system with drag-to-resize
// SDD §1: systemPanels (sticky) + mode panels + tool panels
import { useState, useEffect, useRef, useCallback } from "react";
import type { PanelDescriptor } from "../core/ToolRegistry";
import "./BottomSlot.css";

interface BottomSlotProps {
  panels: PanelDescriptor[];
  /** Additional tool-specific panels */
  toolPanels?: PanelDescriptor[];
}

const DEFAULT_HEIGHT = 200;
const MIN_HEIGHT = 80;

export default function BottomSlot({ panels, toolPanels }: BottomSlotProps) {
  const allPanels = [...panels];
  if (toolPanels) allPanels.push(...toolPanels);

  const [activeId, setActiveId] = useState<string>(
    allPanels.find((p) => p.defaultOpen)?.id ?? allPanels[0]?.id ?? ""
  );
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const containerRef = useRef<HTMLDivElement>(null);

  const clampHeight = useCallback((h: number) => {
    const maxH = Math.floor(window.innerHeight * 0.6);
    return Math.max(MIN_HEIGHT, Math.min(h, maxH));
  }, []);

  // Drag: direct DOM manipulation during move, React update on release
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let startY = 0;
    let startH = 0;
    let dragging = false;

    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const delta = startY - e.clientY;
      const newH = clampHeight(startH + delta);
      container.style.height = `${newH}px`;      // direct DOM — immediate visual
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      // sync DOM → React state (triggers one final re-render)
      const finalH = parseInt(container.style.height, 10) || DEFAULT_HEIGHT;
      setHeight(finalH);
    };

    const onDown = (e: MouseEvent) => {
      // Only resize when clicking the handle, not the tabs
      const target = e.target as HTMLElement;
      if (!target.classList.contains("shell-bottom-slot__resize-handle")) return;
      e.preventDefault();
      dragging = true;
      startY = e.clientY;
      startH = container.offsetHeight;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "row-resize";
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    container.addEventListener("mousedown", onDown);

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      container.removeEventListener("mousedown", onDown);
    };
  }, [clampHeight]);

  const activePanel = allPanels.find((p) => p.id === activeId);

  return (
    <div
      ref={containerRef}
      className="shell-bottom-slot"
      style={{ height: `${height}px`, flexShrink: 0 }}
    >
      {/* Resize handle area — entire top edge is draggable */}
      <div className="shell-bottom-slot__resize-handle" />

      {/* Tab bar */}
      <div className="shell-bottom-slot__tab-bar">
        {allPanels.map((p) => (
          <button
            className={`shell-bottom-slot__tab${activeId === p.id ? " shell-bottom-slot__tab--active" : ""}`}
            key={p.id}
            onClick={() => setActiveId(p.id)}
          >
            {p.title}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {activePanel ? (
          <activePanel.component />
        ) : (
          <div className="shell-bottom-slot__empty">No panels available</div>
        )}
      </div>
    </div>
  );
}
