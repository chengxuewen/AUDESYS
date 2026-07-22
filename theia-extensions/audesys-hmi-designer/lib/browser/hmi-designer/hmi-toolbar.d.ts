import React from "react";
interface HmiToolbarProps {
    editMode: boolean;
    onToggleMode: () => void;
    onSave: () => void;
    onLoad: () => void;
    onClear: () => void;
    onDeploy?: () => void;
}
export default function HmiToolbar({ editMode, onToggleMode, onSave, onLoad, onClear, onDeploy }: HmiToolbarProps): React.JSX.Element;
export {};
//# sourceMappingURL=hmi-toolbar.d.ts.map