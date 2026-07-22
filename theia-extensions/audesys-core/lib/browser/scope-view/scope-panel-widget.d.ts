import * as React from 'react';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import type { Message } from '@theia/core/lib/browser';
/**
 * Scope View Widget — real-time oscilloscope panel using Canvas 2D.
 * Left sidebar for signal selection, center canvas for waveform rendering,
 * toolbar for pause/resume, CSV export, and time window control.
 */
export declare class ScopeViewWidget extends ReactWidget {
    static readonly ID = "audesys.scope-view";
    static readonly LABEL = "Scope View";
    private readonly signalBridge;
    private pollTimer;
    private buffer;
    private canvas;
    private canvasContainer;
    private state;
    private prevActiveChannels;
    constructor();
    protected init(): void;
    protected onAfterAttach(msg: Message): void;
    protected onBeforeDetach(msg: Message): void;
    protected onAfterHide(_msg: Message): void;
    protected onResize(_msg: Message): void;
    protected render(): React.ReactNode;
    private renderToolbar;
    private renderError;
    private renderChannelSelector;
    private renderStatusBar;
    private fetchAndPush;
    private toggleChannel;
    private togglePolling;
    private startPolling;
    private stopPolling;
    private setTimeWindow;
    private resetView;
    private exportCSV;
    private mountCanvas;
    private unmountCanvas;
    private syncCanvasChannels;
    private setState;
}
//# sourceMappingURL=scope-panel-widget.d.ts.map