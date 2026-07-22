import React from "react";
interface IndicatorWidgetProps {
    id: string;
    label: string;
    signal?: string;
    config: Record<string, unknown>;
    width: number;
    height: number;
    isSelected: boolean;
    isPreview: boolean;
}
export default function IndicatorWidget({ signal, config, width, height, isPreview }: IndicatorWidgetProps): React.JSX.Element;
export {};
//# sourceMappingURL=IndicatorWidget.d.ts.map