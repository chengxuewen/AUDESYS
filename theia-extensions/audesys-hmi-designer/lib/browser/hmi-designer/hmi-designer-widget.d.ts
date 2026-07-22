/**
 * HmiDesignerWidget — Theia ReactWidget wrapping HmiDesignerTool.
 *
 * ponytail: thin wrapper around HmiDesignerTool to integrate with Theia dock panel.
 */
import * as React from "react";
import { ReactWidget } from "@theia/core/lib/browser/widgets/react-widget";
import { Message } from "@theia/core/lib/browser/widgets/widget";
export declare class HmiDesignerWidget extends ReactWidget {
    static readonly ID = "hmi-designer";
    constructor();
    protected onAfterAttach(msg: Message): void;
    protected init(): void;
    protected render(): React.ReactNode;
    private handleSave;
    private handleLoad;
    private handleDeploy;
}
//# sourceMappingURL=hmi-designer-widget.d.ts.map