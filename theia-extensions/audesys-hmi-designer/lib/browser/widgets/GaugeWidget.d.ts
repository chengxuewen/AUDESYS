import React from "react";
interface GaugeWidgetProps {
    id: string;
    label: string;
    signal?: string;
    config: Record<string, unknown>;
    width: number;
    height: number;
    isSelected: boolean;
    isPreview: boolean;
}
export default function GaugeWidget({ signal, config, width, height, isPreview }: GaugeWidgetProps): React.JSX.Element;
export {};
//# sourceMappingURL=GaugeWidget.d.ts.map