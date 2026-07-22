import React from "react";
interface TrendWidgetProps {
    id: string;
    label: string;
    signal?: string;
    config: Record<string, unknown>;
    width: number;
    height: number;
    isSelected: boolean;
    isPreview: boolean;
}
export default function TrendWidget({ label, signal, config, width, height, isPreview }: TrendWidgetProps): React.JSX.Element;
export {};
//# sourceMappingURL=TrendWidget.d.ts.map