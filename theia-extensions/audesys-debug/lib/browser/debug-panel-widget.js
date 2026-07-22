"use strict";
/**
 * AUDESYS Debug Panel Widget — Bottom panel with connect/disconnect + quick status.
 *
 * ponytail: renders via innerHTML instead of React/JSX. No JSX dependency.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugPanelWidget = void 0;
const browser_1 = require("@theia/core/lib/browser");
class DebugPanelWidget extends browser_1.BaseWidget {
    constructor() {
        super();
        this.socketPath = '/tmp/audesys-controller.sock';
        this.secret = 'audesys-dev-secret';
        this.connected = false;
        this.status = 'idle';
        this.registers = [];
        this.bpList = [];
        this.bpInput = '';
        this.id = DebugPanelWidget.ID;
        this.title.label = 'AUDESYS Debug';
        this.title.caption = 'AUDESYS Controller Debug Panel';
        this.title.closable = true;
        this.node.style.padding = '12px';
        this.node.style.fontFamily = 'monospace';
        this.node.style.fontSize = '12px';
    }
    onUpdateRequest(_msg) {
        this.node.innerHTML = this.renderHtml();
        this.attachListeners();
    }
    renderHtml() {
        const s = this;
        let html = '<div style="font-weight:bold;margin-bottom:8px">AUDESYS Debug Panel</div>';
        if (!s.connected) {
            html += this.renderConnectForm();
        }
        else {
            html += this.renderDebugControls();
        }
        if (s.status) {
            html += `<div style="margin-top:8px;padding:4px 8px;background:var(--theia-badge-background);color:var(--theia-badge-foreground);border-radius:4px">${this.esc(s.status)}</div>`;
        }
        return html;
    }
    renderConnectForm() {
        return `
            <div>
                <div style="margin-bottom:6px">
                    <label style="display:block;margin-bottom:2px">Socket Path</label>
                    <input id="debug-socket-path" value="${this.esc(this.socketPath)}" style="width:100%;padding:4px;font-family:monospace;font-size:12px" />
                </div>
                <div style="margin-bottom:6px">
                    <label style="display:block;margin-bottom:2px">Secret</label>
                    <input id="debug-secret" value="${this.esc(this.secret)}" style="width:100%;padding:4px;font-family:monospace;font-size:12px" />
                </div>
                <button id="debug-connect-btn" style="padding:4px 12px;cursor:pointer">Connect</button>
            </div>`;
    }
    renderDebugControls() {
        const s = this;
        let html = `
            <div>
                <div style="margin-bottom:8px;display:flex;gap:4px">
                    <button id="debug-pause-btn" title="Pause">⏸</button>
                    <button id="debug-resume-btn" title="Resume">▶</button>
                    <button id="debug-step-btn" title="Step">⏭</button>
                    <button id="debug-disconnect-btn" style="margin-left:auto" title="Disconnect">✕</button>
                </div>`;
        if (s.registers.length > 0) {
            html += '<div style="margin-bottom:8px"><div style="font-weight:bold;margin-bottom:4px">Registers</div>';
            html += '<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr>';
            for (const [name] of s.registers) {
                html += `<th style="padding:2px 4px;text-align:center;border:1px solid var(--theia-dropdown-border)">${this.esc(name)}</th>`;
            }
            html += '</tr></thead><tbody><tr>';
            for (const [, val] of s.registers) {
                html += `<td style="padding:2px 4px;text-align:center;border:1px solid var(--theia-dropdown-border)">${this.esc(val)}</td>`;
            }
            html += '</tr></tbody></table></div>';
        }
        html += `
            <div style="margin-bottom:8px">
                <div style="display:flex;gap:4px;margin-bottom:4px">
                    <input id="debug-bp-input" placeholder="IP address" style="flex:1;padding:4px;font-family:monospace;font-size:12px" />
                    <button id="debug-add-bp-btn">Add BP</button>
                </div>
                <button id="debug-refresh-bp-btn" style="width:100%">Refresh BPs</button>`;
        if (s.bpList.length > 0) {
            html += '<div style="margin-top:4px">';
            for (const bp of s.bpList) {
                html += `<div style="display:flex;justify-content:space-between;padding:2px 4px;background:var(--theia-badge-background);margin-bottom:2px;border-radius:2px">
                    <span>0x${bp.toString(16).toUpperCase()}</span>
                    <button class="debug-rm-bp-btn" data-ip="${bp}" style="cursor:pointer;border:none;background:none">✕</button>
                </div>`;
            }
            html += '</div>';
        }
        html += '</div></div>';
        return html;
    }
    attachListeners() {
        if (!this.connected) {
            this.el('debug-connect-btn')?.addEventListener('click', () => {
                const sockEl = this.node.querySelector('#debug-socket-path');
                const secEl = this.node.querySelector('#debug-secret');
                if (sockEl)
                    this.socketPath = sockEl.value;
                if (secEl)
                    this.secret = secEl.value;
                this.connected = true;
                this.status = 'connected (stub)';
                this.update();
            });
            return;
        }
        this.el('debug-pause-btn')?.addEventListener('click', () => { this.status = 'paused'; this.update(); });
        this.el('debug-resume-btn')?.addEventListener('click', () => { this.status = 'running'; this.update(); });
        this.el('debug-step-btn')?.addEventListener('click', () => { this.status = 'stepped'; this.update(); });
        this.el('debug-disconnect-btn')?.addEventListener('click', () => {
            this.connected = false;
            this.status = 'disconnected';
            this.registers = [];
            this.bpList = [];
            this.update();
        });
        this.el('debug-add-bp-btn')?.addEventListener('click', () => {
            const inp = this.node.querySelector('#debug-bp-input');
            const ip = parseInt(inp?.value ?? '', 10);
            if (!isNaN(ip) && !this.bpList.includes(ip)) {
                this.bpList.push(ip);
                this.update();
            }
        });
        this.node.querySelectorAll('.debug-rm-bp-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const ip = parseInt(btn.dataset.ip ?? '', 10);
                this.bpList = this.bpList.filter(b => b !== ip);
                this.update();
            });
        });
    }
    el(id) {
        return this.node.querySelector(`#${id}`);
    }
    esc(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
exports.DebugPanelWidget = DebugPanelWidget;
DebugPanelWidget.ID = 'audesys-debug-panel';
//# sourceMappingURL=debug-panel-widget.js.map