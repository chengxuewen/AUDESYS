import React from "react";
interface TankWidgetProps {
    id: string;
    label: string;
    signal?: string;
    config: Record<string, unknown>;
    width: number;
    height: number;
    isSelected: boolean;
    isPreview: boolean;
}
export default function TankWidget({ signal, config, width, height, isPreview }: TankWidgetProps): React.JSX.Element;
export {};
//# sourceMappingURL=TankWidget.d.ts.map