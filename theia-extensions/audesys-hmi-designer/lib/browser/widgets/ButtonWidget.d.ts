import React from "react";
interface ButtonWidgetProps {
    id: string;
    label: string;
    signal?: string;
    config: Record<string, unknown>;
    width: number;
    height: number;
    isSelected: boolean;
    isPreview: boolean;
}
export default function ButtonWidget({ label, signal, config, width, height, isSelected, isPreview }: ButtonWidgetProps): React.JSX.Element;
export {};
//# sourceMappingURL=ButtonWidget.d.ts.map