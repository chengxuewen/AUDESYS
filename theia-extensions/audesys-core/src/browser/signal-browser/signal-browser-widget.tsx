import * as React from 'react';
import { injectable, inject, postConstruct, optional } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import type { Message } from '@theia/core/lib/browser';
import { SignalBridgeService } from '../../common/signal-bridge-protocol';
import type { SignalEntry } from '../../common/signal-bridge-protocol';
import { SignalTreeModel } from './signal-tree-model';

interface WidgetState {
    signals: SignalEntry[];
    pattern: string;
    polling: boolean;
    count: number;
    error: string | null;
}

/**
 * Signal Browser Widget — live controller signal viewer with tree grouping.
 */
@injectable()
export class SignalBrowserWidget extends ReactWidget {
    static readonly ID = 'audesys.signal-browser';
    static readonly LABEL = 'Signal Browser';

    @optional() @inject(SignalBridgeService)
    private readonly signalBridge: SignalBridgeService | undefined;

    private treeModel = new SignalTreeModel();
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private state: WidgetState = {
        signals: [],
        pattern: '*',
        polling: false,
        count: 0,
        error: null,
    };

    constructor() {
        super();
        this.id = SignalBrowserWidget.ID;
        this.title.label = SignalBrowserWidget.LABEL;
        this.title.caption = 'Live controller signal monitor';
        this.title.closable = true;
        this.title.iconClass = 'fa fa-signal';
        this.addClass('audesys-signal-browser');
    }

    @postConstruct()
    protected init(): void {
        this.update();
    }

    protected override onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.startPolling();
    }

    protected override onBeforeDetach(msg: Message): void {
        this.stopPolling();
        super.onBeforeDetach(msg);
    }

    protected override onAfterHide(_msg: Message): void {
        this.stopPolling();
    }

    protected render(): React.ReactNode {
        const { signals, pattern, polling } = this.state;
        this.treeModel.update(SignalTreeModel.filter(signals, pattern));
        const groups = this.treeModel.getGroups();

        return React.createElement('div',
            { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
            this.renderToolbar(pattern, polling),
            this.renderError(),
            this.renderTree(groups),
            this.renderStatusBar(),
        );
    }

    private renderToolbar(pattern: string, polling: boolean): React.ReactNode {
        return React.createElement('div', {
            style: {
                padding: '4px 6px', display: 'flex', gap: 4, alignItems: 'center',
                borderBottom: '1px solid var(--theia-sideBar-sectionHeader-border, #383838)',
            },
        },
            React.createElement('input', {
                type: 'text',
                value: pattern,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                    this.setState({ pattern: e.target.value }),
                style: {
                    flex: 1, fontSize: 12, padding: '2px 6px',
                    border: '1px solid var(--theia-input-border)',
                    background: 'var(--theia-input-background)',
                    color: 'var(--theia-input-foreground)',
                    borderRadius: 2,
                    fontFamily: 'var(--theia-ui-font-family)',
                },
                placeholder: 'axis.*',
            }),
            !polling
                ? React.createElement('button', {
                    onClick: () => this.startPolling(),
                    style: { fontSize: 11, padding: '2px 6px', whiteSpace: 'nowrap' },
                }, 'Start')
                : React.createElement('button', {
                    onClick: () => this.stopPolling(),
                    style: { fontSize: 11, padding: '2px 6px', whiteSpace: 'nowrap' },
                }, 'Stop'),
        );
    }

    private renderError(): React.ReactNode | null {
        const { error } = this.state;
        if (!error) return null;
        return React.createElement('div', {
            style: {
                padding: '4px 8px', color: 'var(--theia-errorForeground)',
                fontSize: 11, background: 'var(--theia-inputValidation-errorBackground)',
            },
        }, error);
    }

    private renderTree(groups: ReturnType<SignalTreeModel['getGroups']>): React.ReactNode {
        if (groups.length === 0) {
            return React.createElement('div', {
                style: {
                    flex: 1, overflow: 'auto', padding: '12px 8px',
                    color: 'var(--theia-descriptionForeground)', fontSize: 12,
                },
            }, this.state.polling ? 'Waiting for signals...' : 'Click Start to begin polling.');
        }
        return React.createElement('div',
            { style: { flex: 1, overflow: 'auto' } },
            ...groups.map(g => this.renderGroup(g)),
        );
    }

    private renderGroup(g: { namespace: string; signals: SignalEntry[]; expanded: boolean }): React.ReactNode {
        return React.createElement('div', { key: g.namespace },
            this.renderGroupHeader(g),
            g.expanded && g.signals.map(s =>
                React.createElement('div', {
                    key: s.name,
                    style: {
                        padding: '2px 8px 2px 28px', fontSize: 12,
                        fontFamily: 'var(--theia-editor-font-family, monospace)',
                        color: 'var(--theia-foreground)',
                        display: 'flex', justifyContent: 'space-between',
                        borderBottom: '1px solid var(--theia-sideBar-background)',
                    },
                },
                    React.createElement('span', null, s.name),
                    React.createElement('span', {
                        style: { color: 'var(--theia-debugIcon-startForeground)', marginLeft: 12 },
                    }, s.value),
                ),
            ),
        );
    }

    private renderGroupHeader(g: { namespace: string; expanded: boolean; signals: SignalEntry[] }): React.ReactNode {
        return React.createElement('div', {
            onClick: () => this.toggleGroup(g.namespace),
            style: {
                padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                color: 'var(--theia-sideBarTitle-foreground)',
                background: 'var(--theia-sideBar-sectionHeader-background)',
                borderBottom: '1px solid var(--theia-sideBar-sectionHeader-border, #383838)',
                display: 'flex', alignItems: 'center', gap: 4,
            },
            role: 'treeitem',
            'aria-expanded': g.expanded,
        },
            React.createElement('span',
                { style: { fontSize: 10, width: 12 } },
                g.expanded ? '\u25BC' : '\u25B6',
            ),
            g.namespace,
            React.createElement('span', {
                style: { fontSize: 10, color: 'var(--theia-descriptionForeground)', marginLeft: 'auto' },
            }, String(g.signals.length)),
        );
    }

    private renderStatusBar(): React.ReactNode {
        const { polling, count, signals } = this.state;
        return React.createElement('div', {
            style: {
                padding: '2px 8px', fontSize: 10,
                color: 'var(--theia-descriptionForeground)',
                borderTop: '1px solid var(--theia-sideBar-sectionHeader-border, #383838)',
                display: 'flex', justifyContent: 'space-between',
            },
        },
            React.createElement('span', null, polling ? `\u25CF Live (${count})` : '\u25CB Idle'),
            React.createElement('span', null,
                `${this.treeModel.getGroups().length} groups, ${signals.length} signals`),
        );
    }

    private async fetchSignals(): Promise<void> {
        if (!this.signalBridge) return;
        try {
            const signals = await this.signalBridge.signalSnapshot(this.state.pattern);
            this.setState({ signals, count: this.state.count + 1, error: null });
        } catch (_err) {
            // ponytail: controller may not respond every tick; only show first error
            if (!this.state.error) {
                this.setState({ error: 'Controller unreachable. Check connection.' });
            }
        }
    }

    private startPolling(): void {
        if (this.state.polling) return;
        this.setState({ polling: true });
        this.fetchSignals();
        // ponytail: 500ms interval, fine for dev; push mode later
        this.pollTimer = setInterval(() => { this.fetchSignals(); }, 500);
    }

    private stopPolling(): void {
        this.setState({ polling: false });
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    private toggleGroup(namespace: string): void {
        this.treeModel.toggleGroup(namespace);
        this.update();
    }

    private setState(partial: Partial<WidgetState>): void {
        this.state = { ...this.state, ...partial };
        this.update();
    }
}
