import React from "react";
import type { HmiWidgetType } from "../types/hmi";
interface WidgetPaletteProps {
    onAddWidget: (type: HmiWidgetType, label: string) => void;
}
export default function WidgetPalette({ onAddWidget }: WidgetPaletteProps): React.JSX.Element;
export {};
//# sourceMappingURL=widget-palette.d.ts.map