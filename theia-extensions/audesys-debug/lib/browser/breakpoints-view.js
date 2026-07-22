"use strict";
/**
 * Breakpoints View — Breakpoint list with add/remove.
 *
 * Renders via innerHTML. No React/JSX dependency.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BreakpointsViewWidget = void 0;
const browser_1 = require("@theia/core/lib/browser");
class BreakpointsViewWidget extends browser_1.BaseWidget {
    constructor() {
        super();
        this.breakpoints = [];
        this.inputValue = '';
        this.id = BreakpointsViewWidget.ID;
        this.title.label = 'Breakpoints';
        this.title.caption = 'AUDESYS Controller Breakpoints';
        this.title.closable = true;
        this.node.style.padding = '8px';
        this.node.style.fontSize = '12px';
        this.node.style.fontFamily = 'monospace';
    }
    setBreakpoints(bps) {
        this.breakpoints = bps;
        this.update();
    }
    onUpdateRequest(_msg) {
        this.node.innerHTML = this.renderHtml();
        this.attachListeners();
    }
    renderHtml() {
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
                if (bp.line !== undefined)
                    html += ` (line ${bp.line})`;
                html += '</span>';
                html += `<button class="bp-rm-btn" data-ip="${bp.ip}" style="cursor:pointer;border:none;background:none;font-size:14px;padding:0 4px" title="Remove">✕</button>`;
                html += '</div>';
            }
            html += '</div>';
        }
        else {
            html += '<div style="font-style:italic">No breakpoints set. Add a breakpoint by IP address above.</div>';
        }
        return html;
    }
    attachListeners() {
        this.el('bp-add-btn')?.addEventListener('click', () => {
            const inp = this.node.querySelector('#bp-input');
            const ip = parseInt(inp?.value ?? '', 10);
            if (!isNaN(ip) && !this.breakpoints.some(b => b.ip === ip)) {
                this.breakpoints.push({ ip, verified: true });
                this.update();
            }
        });
        this.node.querySelectorAll('.bp-rm-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const ip = parseInt(btn.dataset.ip ?? '', 10);
                this.breakpoints = this.breakpoints.filter(b => b.ip !== ip);
                this.update();
            });
        });
    }
    el(id) {
        return this.node.querySelector(`#${id}`);
    }
}
exports.BreakpointsViewWidget = BreakpointsViewWidget;
BreakpointsViewWidget.ID = 'audesys-breakpoints-view';
//# sourceMappingURL=breakpoints-view.js.map