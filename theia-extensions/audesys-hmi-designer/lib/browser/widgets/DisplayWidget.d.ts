import React from "react";
interface DisplayWidgetProps {
    id: string;
    label: string;
    signal?: string;
    config: Record<string, unknown>;
    width: number;
    height: number;
    isSelected: boolean;
    isPreview: boolean;
}
export default function DisplayWidget({ signal, config, width, height, isPreview }: DisplayWidgetProps): React.JSX.Element;
export {};
//# sourceMappingURL=DisplayWidget.d.ts.map