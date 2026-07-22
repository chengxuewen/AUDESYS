"use strict";
/**
 * Variables View — TreeView for VM register values (r0–r13).
 *
 * Renders via innerHTML. No React/JSX dependency.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VariablesViewWidget = void 0;
const browser_1 = require("@theia/core/lib/browser");
class VariablesViewWidget extends browser_1.BaseWidget {
    constructor() {
        super();
        this.registers = [];
        this.loading = false;
        this.id = VariablesViewWidget.ID;
        this.title.label = 'Registers';
        this.title.caption = 'AUDESYS VM Register Values (r0–r13)';
        this.title.closable = true;
        this.node.style.padding = '8px';
        this.node.style.fontSize = '12px';
        this.node.style.fontFamily = 'monospace';
    }
    setRegisters(regs) {
        this.registers = regs;
        this.loading = false;
        this.update();
    }
    setLoading(v) {
        this.loading = v;
        this.update();
    }
    onUpdateRequest(_msg) {
        this.node.innerHTML = this.renderHtml();
        this.el('vv-refresh-btn')?.addEventListener('click', () => this.refresh());
    }
    renderHtml() {
        let html = '<div style="font-weight:bold;margin-bottom:8px;display:flex;align-items:center;gap:8px">';
        html += '<span>Registers</span>';
        html += '<button id="vv-refresh-btn" style="padding:1px 6px;font-size:11px;cursor:pointer;border:none;border-radius:3px">↻ Refresh</button>';
        html += '</div>';
        if (this.loading) {
            html += '<div style="font-style:italic">Loading registers...</div>';
        }
        else if (this.registers.length > 0) {
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
        }
        else {
            html += '<div style="font-style:italic">Connect to a Controller to view register values.</div>';
        }
        return html;
    }
    refresh() {
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
    el(id) {
        return this.node.querySelector(`#${id}`);
    }
    esc(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
exports.VariablesViewWidget = VariablesViewWidget;
VariablesViewWidget.ID = 'audesys-variables-view';
//# sourceMappingURL=variables-view.js.map