import React from "react";
interface TextWidgetProps {
    id: string;
    label: string;
    signal?: string;
    config: Record<string, unknown>;
    width: number;
    height: number;
    isSelected: boolean;
    isPreview: boolean;
}
export default function TextWidget({ label, signal, config, width, height, isPreview }: TextWidgetProps): React.JSX.Element;
export {};
//# sourceMappingURL=TextWidget.d.ts.map