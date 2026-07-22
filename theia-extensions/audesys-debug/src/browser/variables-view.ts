/**
 * Variables View — TreeView for VM register values (r0–r13).
 *
 * Renders via innerHTML. No React/JSX dependency.
 */

import { BaseWidget, Message } from '@theia/core/lib/browser';

export interface RegisterEntry {
    name: string;
    value: string;
}

export class VariablesViewWidget extends BaseWidget {
    static readonly ID = 'audesys-variables-view';

    private registers: RegisterEntry[] = [];
    private loading = false;

    constructor() {
        super();
        this.id = VariablesViewWidget.ID;
        this.title.label = 'Registers';
        this.title.caption = 'AUDESYS VM Register Values (r0–r13)';
        this.title.closable = true;
        this.node.style.padding = '8px';
        this.node.style.fontSize = '12px';
        this.node.style.fontFamily = 'monospace';
    }

    setRegisters(regs: RegisterEntry[]): void {
        this.registers = regs;
        this.loading = false;
        this.update();
    }

    setLoading(v: boolean): void {
        this.loading = v;
        this.update();
    }

    protected onUpdateRequest(_msg: Message): void {
        this.node.innerHTML = this.renderHtml();
        this.el('vv-refresh-btn')?.addEventListener('click', () => this.refresh());
    }

    private renderHtml(): string {
        let html = '<div style="font-weight:bold;margin-bottom:8px;display:flex;align-items:center;gap:8px">';
        html += '<span>Registers</span>';
        html += '<button id="vv-refresh-btn" style="padding:1px 6px;font-size:11px;cursor:pointer;border:none;border-radius:3px">↻ Refresh</button>';
        html += '</div>';

        if (this.loading) {
            html += '<div style="font-style:italic">Loading registers...</div>';
        } else if (this.registers.length > 0) {
            html += '<table style="width:100%;border-collapse:collapse">';
            html += '<thead><tr style="text-align:left">';
            html += '<th style="padding:2px 8px;border-bottom:1px solid var(--theia-dropdown-border)">Name</th>';
            html += '<th style="padding:2px 8px;border-bottom:1px solid var(--theia-dropdown-border)">Value</th>';
            html += '</tr></thead><tbody>';
            for (const reg of this.registers) {
                html += `<tr style="border-bottom:1px solid var(--theia-tree-indentGuidesStroke)">`;
                html += `<td style="padding:2px 8px;color:var(--theia-symbolIcon-variableForeground)">${this.esc(reg.name)}</td>`;
                html += `<td style="padding:2px 8px;color:var(--theia-debugTokenExpression-number)">${this.esc(reg.value)}</td>`;
                html += '</tr>';
            }
            html += '</tbody></table>';
        } else {
            html += '<div style="font-style:italic">Connect to a Controller to view register values.</div>';
        }
        return html;
    }

    private refresh(): void {
        this.setRegisters([
            { name: 'r0', value: '0x00000000' }, { name: 'r1', value: '0x00000000' },
            { name: 'r2', value: '0x00000000' }, { name: 'r3', value: '0x00000000' },
            { name: 'r4', value: '0x00000000' }, { name: 'r5', value: '0x00000000' },
            { name: 'r6', value: '0x00000000' }, { name: 'r7', value: '0x00000000' },
            { name: 'r8', value: '0x00000000' }, { name: 'r9', value: '0x00000000' },
            { name: 'r10', value: '0x00000000' }, { name: 'r11', value: '0x00000000' },
            { name: 'r12', value: '0x00000000' }, { name: 'r13', value: '0x00000000' },
        ]);
    }

    private el(id: string): HTMLElement | null {
        return this.node.querySelector(`#${id}`) as HTMLElement | null;
    }

    private esc(s: string): string {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
