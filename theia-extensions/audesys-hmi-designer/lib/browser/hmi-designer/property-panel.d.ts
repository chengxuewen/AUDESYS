import React from "react";
import type { HmiWidgetState } from "../types/hmi";
interface PropertyPanelProps {
    widget: HmiWidgetState | null;
    onUpdateWidget: (id: string, patch: Partial<HmiWidgetState>) => void;
    onRemoveWidget: (id: string) => void;
}
export default function PropertyPanel({ widget, onUpdateWidget, onRemoveWidget }: PropertyPanelProps): React.JSX.Element;
export {};
//# sourceMappingURL=property-panel.d.ts.map