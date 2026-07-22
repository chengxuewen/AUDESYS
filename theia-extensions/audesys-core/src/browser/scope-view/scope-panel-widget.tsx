import * as React from 'react';
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import type { Message } from '@theia/core/lib/browser';
import { SignalBridgeService } from '../../common/signal-bridge-protocol';
import type { SignalEntry } from '../../common/signal-bridge-protocol';
import { TimeSeriesBuffer } from './time-series-buffer';
import { ScopeCanvas } from './scope-canvas';

interface WidgetState {
    channels: string[];          // all available signal names
    activeChannels: string[];     // currently selected for rendering
    polling: boolean;
    timeWindowSec: number;
    error: string | null;
}

const TIME_WINDOW_OPTIONS = [
    { label: '5s', value: 5 },
    { label: '10s', value: 10 },
    { label: '30s', value: 30 },
];

const MAX_POINTS = 3000;

/**
 * Scope View Widget — real-time oscilloscope panel using Canvas 2D.
 * Left sidebar for signal selection, center canvas for waveform rendering,
 * toolbar for pause/resume, CSV export, and time window control.
 */
@injectable()
export class ScopeViewWidget extends ReactWidget {
    static readonly ID = 'audesys.scope-view';
    static readonly LABEL = 'Scope View';

    @inject(SignalBridgeService)
    private readonly signalBridge!: SignalBridgeService;

    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private buffer = new TimeSeriesBuffer(MAX_POINTS);
    private canvas: ScopeCanvas | null = null;
    private canvasContainer: HTMLDivElement | null = null;

    private state: WidgetState = {
        channels: [],
        activeChannels: [],
        polling: false,
        timeWindowSec: 10,
        error: null,
    };

    // Track previous active channels to detect changes
    private prevActiveChannels: string = '';

    constructor() {
        super();
        this.id = ScopeViewWidget.ID;
        this.title.label = ScopeViewWidget.LABEL;
        this.title.caption = 'Real-time signal oscilloscope';
        this.title.closable = true;
        this.title.iconClass = 'fa fa-chart-line';
        this.addClass('audesys-scope-view');
    }

    @postConstruct()
    protected init(): void {
        this.update();
    }

    protected override onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        // Mount canvas after DOM is attached
        this.mountCanvas();
        this.startPolling();
    }

    protected override onBeforeDetach(msg: Message): void {
        this.stopPolling();
        this.unmountCanvas();
        super.onBeforeDetach(msg);
    }

    protected override onAfterHide(_msg: Message): void {
        this.stopPolling();
    }

    protected override onResize(_msg: Message): void {
        this.canvas?.resize();
    }

    protected render(): React.ReactNode {
        const { polling, timeWindowSec, channels, activeChannels, error } = this.state;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {this.renderToolbar(polling, timeWindowSec)}
                {error && this.renderError(error)}
                <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                    {this.renderChannelSelector(channels, activeChannels)}
                    <div
                        ref={el => { this.canvasContainer = el; }}
                        style={{
                            flex: 1,
                            minWidth: 0,
                            position: 'relative',
                            background: '#1a1a2e',
                        }}
                    />
                </div>
                {this.renderStatusBar()}
            </div>
        );
    }

    private renderToolbar(polling: boolean, timeWindowSec: number): React.ReactNode {
        return (
            <div style={{
                padding: '4px 8px', display: 'flex', gap: 6, alignItems: 'center',
                borderBottom: '1px solid var(--theia-sideBar-sectionHeader-border, #383838)',
                flexWrap: 'wrap',
            }}>
                <button
                    onClick={() => this.togglePolling()}
                    style={toolbarBtnStyle(polling)}
                >
                    {polling ? '\u23F8 Pause' : '\u25B6 Resume'}
                </button>

                <button
                    onClick={() => this.exportCSV()}
                    style={toolbarBtnStyle(false)}
                    disabled={!polling || this.buffer.length === 0}
                >
                    {'\u2B07 CSV'}
                </button>

                <span style={{ fontSize: 11, color: 'var(--theia-descriptionForeground)' }}>
                    Time:
                </span>
                <select
                    value={timeWindowSec}
                    onChange={e => this.setTimeWindow(Number(e.target.value))}
                    style={{
                        fontSize: 11, padding: '1px 4px',
                        background: 'var(--theia-input-background)',
                        color: 'var(--theia-input-foreground)',
                        border: '1px solid var(--theia-input-border)',
                        borderRadius: 2,
                    }}
                >
                    {TIME_WINDOW_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>

                <button
                    onClick={() => this.resetView()}
                    style={toolbarBtnStyle(false)}
                    title="Reset pan/zoom"
                >
                    {'\u21BA Reset'}
                </button>
            </div>
        );
    }

    private renderError(error: string): React.ReactNode {
        return (
            <div style={{
                padding: '4px 8px', color: 'var(--theia-errorForeground)',
                fontSize: 11, background: 'var(--theia-inputValidation-errorBackground)',
            }}>
                {error}
            </div>
        );
    }

    private renderChannelSelector(
        channels: string[],
        activeChannels: string[],
    ): React.ReactNode {
        return (
            <div style={{
                width: 180, flexShrink: 0, overflow: 'auto', padding: '4px 0',
                borderRight: '1px solid var(--theia-sideBar-sectionHeader-border, #383838)',
                fontSize: 11,
            }}>
                <div style={{
                    padding: '4px 8px', fontWeight: 600,
                    color: 'var(--theia-sideBarTitle-foreground)',
                    borderBottom: '1px solid var(--theia-sideBar-sectionHeader-border, #383838)',
                }}>
                    Channels ({activeChannels.length})
                </div>
                {channels.length === 0 ? (
                    <div style={{
                        padding: '8px', color: 'var(--theia-descriptionForeground)',
                        fontSize: 11,
                    }}>
                        Start polling to discover signals
                    </div>
                ) : (
                    channels.map(ch => {
                        const checked = activeChannels.includes(ch);
                        return (
                            <label
                                key={ch}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    padding: '2px 8px', cursor: 'pointer',
                                    color: 'var(--theia-foreground)',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => this.toggleChannel(ch)}
                                    style={{ margin: 0 }}
                                />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {ch}
                                </span>
                            </label>
                        );
                    })
                )}
            </div>
        );
    }

    private renderStatusBar(): React.ReactNode {
        const { polling } = this.state;
        const pointCount = this.buffer.length;
        return (
            <div style={{
                padding: '2px 8px', fontSize: 10,
                color: 'var(--theia-descriptionForeground)',
                borderTop: '1px solid var(--theia-sideBar-sectionHeader-border, #383838)',
                display: 'flex', justifyContent: 'space-between',
            }}>
                <span>{polling ? '\u25CF Live' : '\u25CB Paused'}</span>
                <span>{pointCount} {pointCount === 1 ? 'point' : 'points'} buffered</span>
            </div>
        );
    }

    // --- Actions ---

    private async fetchAndPush(): Promise<void> {
        try {
            const signals: SignalEntry[] = await this.signalBridge.signalSnapshot('*');
            this.setState({ error: null });

            const prevChannels = this.state.channels;
            const newChannels = signals.map(s => s.name);
            const changed = newChannels.length !== prevChannels.length ||
                !newChannels.every((n, i) => n === prevChannels[i]);

            if (changed) {
                this.setState({ channels: newChannels });
            }

            // Push numeric values
            const values: Record<string, number> = {};
            for (const s of signals) {
                const n = Number(s.value);
                if (isFinite(n)) values[s.name] = n;
            }
            const now = Date.now();
            this.buffer.push(now, values);
        } catch (_err) {
            if (!this.state.error) {
                this.setState({ error: 'Controller unreachable. Check connection.' });
            }
        }
    }

    private toggleChannel(name: string): void {
        const { activeChannels } = this.state;
        const next = activeChannels.includes(name)
            ? activeChannels.filter(c => c !== name)
            : [...activeChannels, name];
        this.setState({ activeChannels: next });
    }

    private togglePolling(): void {
        if (this.state.polling) {
            this.stopPolling();
        } else {
            this.setState({ polling: true });
            this.fetchAndPush();
            // ponytail: 100ms poll interval for scope view (faster than signal browser)
            this.pollTimer = setInterval(() => { this.fetchAndPush(); }, 100);
        }
    }

    private startPolling(): void {
        // Don't auto-start; let user click Resume
    }

    private stopPolling(): void {
        this.setState({ polling: false });
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    private setTimeWindow(sec: number): void {
        this.setState({ timeWindowSec: sec });
        if (this.canvas) {
            this.canvas.timeWindowSec = sec;
        }
    }

    private resetView(): void {
        this.canvas?.resetView();
    }

    private exportCSV(): void {
        if (!this.canvas) return;
        const csv = this.canvas.exportCSV();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scope-view-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // --- Canvas lifecycle ---

    private mountCanvas(): void {
        if (!this.canvasContainer) return;
        if (this.canvas) {
            this.canvas.destroy();
        }
        this.canvas = new ScopeCanvas(this.canvasContainer);
        this.canvas.timeWindowSec = this.state.timeWindowSec;
        this.canvas.start();
        this.syncCanvasChannels();
    }

    private unmountCanvas(): void {
        if (this.canvas) {
            this.canvas.stop();
            this.canvas.destroy();
            this.canvas = null;
        }
    }

    private syncCanvasChannels(): void {
        if (!this.canvas) return;
        this.canvas.buffer = this.buffer;
        this.canvas.activeChannels = this.state.activeChannels;
    }

    // --- State ---

    private setState(partial: Partial<WidgetState>): void {
        this.state = { ...this.state, ...partial };
        this.syncCanvasChannels();
        this.update();
    }
}

function toolbarBtnStyle(active: boolean): React.CSSProperties {
    return {
        fontSize: 11, padding: '2px 8px', whiteSpace: 'nowrap',
        border: '1px solid var(--theia-button-border)',
        background: active
            ? 'var(--theia-button-background)'
            : 'var(--theia-secondaryButton-background)',
        color: 'var(--theia-button-foreground)',
        borderRadius: 2,
        cursor: 'pointer',
        fontFamily: 'var(--theia-ui-font-family)',
    };
}
