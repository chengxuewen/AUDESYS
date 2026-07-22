/**
 * HmiDesignerTool — Orchestrates canvas + palette + property panel + toolbar.
 *
 * ponytail: wraps useHmiLayout hook + sub-components in a flex layout,
 * matching the original HmiDesignerTool but without Tauri/platform deps.
 */
import React from "react";
interface HmiDesignerToolProps {
    /** Expose YAML save result callback */
    onSaveYaml?: (yaml: string) => void;
    /** Expose YAML load callback (= set layout) */
    onLoadYaml?: () => Promise<string | null>;
    /** Expose deploy callback */
    onDeploy?: (yaml: string) => Promise<void>;
}
export default function HmiDesignerTool({ onSaveYaml, onLoadYaml, onDeploy }: HmiDesignerToolProps): React.JSX.Element;
export {};
//# sourceMappingURL=hmi-designer-tool.d.ts.map