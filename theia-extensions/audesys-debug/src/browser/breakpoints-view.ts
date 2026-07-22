/**
 * Breakpoints View — Breakpoint list with add/remove.
 *
 * Renders via innerHTML. No React/JSX dependency.
 */

import { BaseWidget, Message } from '@theia/core/lib/browser';

interface BpEntry {
    ip: number;
    line?: number;
    verified: boolean;
}

export class BreakpointsViewWidget extends BaseWidget {
    static readonly ID = 'audesys-breakpoints-view';

    private breakpoints: BpEntry[] = [];
    private inputValue = '';

    constructor() {
        super();
        this.id = BreakpointsViewWidget.ID;
        this.title.label = 'Breakpoints';
        this.title.caption = 'AUDESYS Controller Breakpoints';
        this.title.closable = true;
        this.node.style.padding = '8px';
        this.node.style.fontSize = '12px';
        this.node.style.fontFamily = 'monospace';
    }

    setBreakpoints(bps: BpEntry[]): void {
        this.breakpoints = bps;
        this.update();
    }

    protected onUpdateRequest(_msg: Message): void {
        this.node.innerHTML = this.renderHtml();
        this.attachListeners();
    }

    private renderHtml(): string {
        let html = '<div style="font-weight:bold;margin-bottom:8px">Breakpoints</div>';

        html += '<div style="display:flex;gap:4px;margin-bottom:8px">';
        html += '<input id="bp-input" placeholder="IP (e.g. 42)" style="flex:1;padding:4px;font-family:monospace;font-size:12px" />';
        html += '<button id="bp-add-btn" style="padding:4px 10px;cursor:pointer;border:none;border-radius:2px">Add</button>';
        html += '</div>';

        if (this.breakpoints.length > 0) {
            html += '<div>';
            for (let i = 0; i < this.breakpoints.length; i++) {
                const bp = this.breakpoints[i];
                const bg = bp.verified
                    ? 'var(--theia-badge-background)'
                    : 'var(--theia-inputValidation-errorBackground)';
                html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 6px;margin-bottom:2px;background:${bg};border-radius:2px">`;
                html += `<span><span style="color:var(--theia-debugIcon-breakpointForeground);margin-right:6px">${bp.verified ? '●' : '○'}</span>`;
                html += `IP: ${bp.ip}`;
                if (bp.line !== undefined) html += ` (line ${bp.line})`;
                html += '</span>';
                html += `<button class="bp-rm-btn" data-ip="${bp.ip}" style="cursor:pointer;border:none;background:none;font-size:14px;padding:0 4px" title="Remove">✕</button>`;
                html += '</div>';
            }
            html += '</div>';
        } else {
            html += '<div style="font-style:italic">No breakpoints set. Add a breakpoint by IP address above.</div>';
        }
        return html;
    }

    private attachListeners(): void {
        this.el('bp-add-btn')?.addEventListener('click', () => {
            const inp = this.node.querySelector('#bp-input') as HTMLInputElement;
            const ip = parseInt(inp?.value ?? '', 10);
            if (!isNaN(ip) && !this.breakpoints.some(b => b.ip === ip)) {
                this.breakpoints.push({ ip, verified: true });
                this.update();
            }
        });

        this.node.querySelectorAll('.bp-rm-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const ip = parseInt((btn as HTMLElement).dataset.ip ?? '', 10);
                this.breakpoints = this.breakpoints.filter(b => b.ip !== ip);
                this.update();
            });
        });
    }

    private el(id: string): HTMLElement | null {
        return this.node.querySelector(`#${id}`) as HTMLElement | null;
    }
}
