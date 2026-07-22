import * as React from 'react';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import type { Message } from '@theia/core/lib/browser';
/**
 * Signal Browser Widget — live controller signal viewer with tree grouping.
 */
export declare class SignalBrowserWidget extends ReactWidget {
    static readonly ID = "audesys.signal-browser";
    static readonly LABEL = "Signal Browser";
    private readonly signalBridge;
    private treeModel;
    private pollTimer;
    private state;
    constructor();
    protected init(): void;
    protected onAfterAttach(msg: Message): void;
    protected onBeforeDetach(msg: Message): void;
    protected onAfterHide(_msg: Message): void;
    protected render(): React.ReactNode;
    private renderToolbar;
    private renderError;
    private renderTree;
    private renderGroup;
    private renderGroupHeader;
    private renderStatusBar;
    private fetchSignals;
    private startPolling;
    private stopPolling;
    private toggleGroup;
    private setState;
}
//# sourceMappingURL=signal-browser-widget.d.ts.map