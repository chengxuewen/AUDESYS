/**
 * HmiCanvas — React component rendered inside the Lumino canvas widget.
 * Renders react-rnd draggable/resizable widgets on a position:relative canvas.
 *
 * ponytail: derived from apps/studio/src/components/HmiBuilder/HmiCanvas.tsx
 * but stripped of outer wrapper — WidgetPalette, toolbar, SignalInjector are
 * handled by HmiDesignerTool.
 */
import React from "react";
import type { HmiWidgetState } from "../../types/hmi";
type HmiCanvasProps = {
    widgets: HmiWidgetState[];
    selectedWidgetId: string | null;
    editMode: boolean;
    onSelectWidget: (id: string | null) => void;
    onUpdateWidget: (id: string, patch: Partial<HmiWidgetState>) => void;
    onRemoveWidget: (id: string) => void;
};
export default function HmiCanvas({ widgets, selectedWidgetId, editMode, onSelectWidget, onUpdateWidget, onRemoveWidget, }: HmiCanvasProps): React.JSX.Element;
export {};
//# sourceMappingURL=HmiCanvas.d.ts.map