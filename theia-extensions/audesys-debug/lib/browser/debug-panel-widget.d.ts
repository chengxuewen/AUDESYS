/**
 * AUDESYS Debug Panel Widget — Bottom panel with connect/disconnect + quick status.
 *
 * ponytail: renders via innerHTML instead of React/JSX. No JSX dependency.
 */
import { BaseWidget, Message } from '@theia/core/lib/browser';
export declare class DebugPanelWidget extends BaseWidget {
    static readonly ID = "audesys-debug-panel";
    private socketPath;
    private secret;
    private connected;
    private status;
    private registers;
    private bpList;
    private bpInput;
    constructor();
    protected onUpdateRequest(_msg: Message): void;
    private renderHtml;
    private renderConnectForm;
    private renderDebugControls;
    private attachListeners;
    private el;
    private esc;
}
//# sourceMappingURL=debug-panel-widget.d.ts.map