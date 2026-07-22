"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ScopeViewWidget_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScopeViewWidget = void 0;
const React = __importStar(require("react"));
const inversify_1 = require("@theia/core/shared/inversify");
const react_widget_1 = require("@theia/core/lib/browser/widgets/react-widget");
const signal_bridge_protocol_1 = require("../../common/signal-bridge-protocol");
const time_series_buffer_1 = require("./time-series-buffer");
const scope_canvas_1 = require("./scope-canvas");
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
let ScopeViewWidget = ScopeViewWidget_1 = class ScopeViewWidget extends react_widget_1.ReactWidget {
    constructor() {
        super();
        this.pollTimer = null;
        this.buffer = new time_series_buffer_1.TimeSeriesBuffer(MAX_POINTS);
        this.canvas = null;
        this.canvasContainer = null;
        this.state = {
            channels: [],
            activeChannels: [],
            polling: false,
            timeWindowSec: 10,
            error: null,
        };
        // Track previous active channels to detect changes
        this.prevActiveChannels = '';
        this.id = ScopeViewWidget_1.ID;
        this.title.label = ScopeViewWidget_1.LABEL;
        this.title.caption = 'Real-time signal oscilloscope';
        this.title.closable = true;
        this.title.iconClass = 'fa fa-chart-line';
        this.addClass('audesys-scope-view');
    }
    init() {
        this.update();
    }
    onAfterAttach(msg) {
        super.onAfterAttach(msg);
        // Mount canvas after DOM is attached
        this.mountCanvas();
        this.startPolling();
    }
    onBeforeDetach(msg) {
        this.stopPolling();
        this.unmountCanvas();
        super.onBeforeDetach(msg);
    }
    onAfterHide(_msg) {
        this.stopPolling();
    }
    onResize(_msg) {
        this.canvas?.resize();
    }
    render() {
        const { polling, timeWindowSec, channels, activeChannels, error } = this.state;
        return (React.createElement("div", { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
            this.renderToolbar(polling, timeWindowSec),
            error && this.renderError(error),
            React.createElement("div", { style: { display: 'flex', flex: 1, minHeight: 0 } },
                this.renderChannelSelector(channels, activeChannels),
                React.createElement("div", { ref: el => { this.canvasContainer = el; }, style: {
                        flex: 1,
                        minWidth: 0,
                        position: 'relative',
                        background: '#1a1a2e',
                    } })),
            this.renderStatusBar()));
    }
    renderToolbar(polling, timeWindowSec) {
        return (React.createElement("div", { style: {
                padding: '4px 8px', display: 'flex', gap: 6, alignItems: 'center',
                borderBottom: '1px solid var(--theia-sideBar-sectionHeader-border, #383838)',
                flexWrap: 'wrap',
            } },
            React.createElement("button", { onClick: () => this.togglePolling(), style: toolbarBtnStyle(polling) }, polling ? '\u23F8 Pause' : '\u25B6 Resume'),
            React.createElement("button", { onClick: () => this.exportCSV(), style: toolbarBtnStyle(false), disabled: !polling || this.buffer.length === 0 }, '\u2B07 CSV'),
            React.createElement("span", { style: { fontSize: 11, color: 'var(--theia-descriptionForeground)' } }, "Time:"),
            React.createElement("select", { value: timeWindowSec, onChange: e => this.setTimeWindow(Number(e.target.value)), style: {
                    fontSize: 11, padding: '1px 4px',
                    background: 'var(--theia-input-background)',
                    color: 'var(--theia-input-foreground)',
                    border: '1px solid var(--theia-input-border)',
                    borderRadius: 2,
                } }, TIME_WINDOW_OPTIONS.map(opt => (React.createElement("option", { key: opt.value, value: opt.value }, opt.label)))),
            React.createElement("button", { onClick: () => this.resetView(), style: toolbarBtnStyle(false), title: "Reset pan/zoom" }, '\u21BA Reset')));
    }
    renderError(error) {
        return (React.createElement("div", { style: {
                padding: '4px 8px', color: 'var(--theia-errorForeground)',
                fontSize: 11, background: 'var(--theia-inputValidation-errorBackground)',
            } }, error));
    }
    renderChannelSelector(channels, activeChannels) {
        return (React.createElement("div", { style: {
                width: 180, flexShrink: 0, overflow: 'auto', padding: '4px 0',
                borderRight: '1px solid var(--theia-sideBar-sectionHeader-border, #383838)',
                fontSize: 11,
            } },
            React.createElement("div", { style: {
                    padding: '4px 8px', fontWeight: 600,
                    color: 'var(--theia-sideBarTitle-foreground)',
                    borderBottom: '1px solid var(--theia-sideBar-sectionHeader-border, #383838)',
                } },
                "Channels (",
                activeChannels.length,
                ")"),
            channels.length === 0 ? (React.createElement("div", { style: {
                    padding: '8px', color: 'var(--theia-descriptionForeground)',
                    fontSize: 11,
                } }, "Start polling to discover signals")) : (channels.map(ch => {
                const checked = activeChannels.includes(ch);
                return (React.createElement("label", { key: ch, style: {
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', cursor: 'pointer',
                        color: 'var(--theia-foreground)',
                    } },
                    React.createElement("input", { type: "checkbox", checked: checked, onChange: () => this.toggleChannel(ch), style: { margin: 0 } }),
                    React.createElement("span", { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, ch)));
            }))));
    }
    renderStatusBar() {
        const { polling } = this.state;
        const pointCount = this.buffer.length;
        return (React.createElement("div", { style: {
                padding: '2px 8px', fontSize: 10,
                color: 'var(--theia-descriptionForeground)',
                borderTop: '1px solid var(--theia-sideBar-sectionHeader-border, #383838)',
                display: 'flex', justifyContent: 'space-between',
            } },
            React.createElement("span", null, polling ? '\u25CF Live' : '\u25CB Paused'),
            React.createElement("span", null,
                pointCount,
                " ",
                pointCount === 1 ? 'point' : 'points',
                " buffered")));
    }
    // --- Actions ---
    async fetchAndPush() {
        try {
            const signals = await this.signalBridge.signalSnapshot('*');
            this.setState({ error: null });
            const prevChannels = this.state.channels;
            const newChannels = signals.map(s => s.name);
            const changed = newChannels.length !== prevChannels.length ||
                !newChannels.every((n, i) => n === prevChannels[i]);
            if (changed) {
                this.setState({ channels: newChannels });
            }
            // Push numeric values
            const values = {};
            for (const s of signals) {
                const n = Number(s.value);
                if (isFinite(n))
                    values[s.name] = n;
            }
            const now = Date.now();
            this.buffer.push(now, values);
        }
        catch (_err) {
            if (!this.state.error) {
                this.setState({ error: 'Controller unreachable. Check connection.' });
            }
        }
    }
    toggleChannel(name) {
        const { activeChannels } = this.state;
        const next = activeChannels.includes(name)
            ? activeChannels.filter(c => c !== name)
            : [...activeChannels, name];
        this.setState({ activeChannels: next });
    }
    togglePolling() {
        if (this.state.polling) {
            this.stopPolling();
        }
        else {
            this.setState({ polling: true });
            this.fetchAndPush();
            // ponytail: 100ms poll interval for scope view (faster than signal browser)
            this.pollTimer = setInterval(() => { this.fetchAndPush(); }, 100);
        }
    }
    startPolling() {
        // Don't auto-start; let user click Resume
    }
    stopPolling() {
        this.setState({ polling: false });
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }
    setTimeWindow(sec) {
        this.setState({ timeWindowSec: sec });
        if (this.canvas) {
            this.canvas.timeWindowSec = sec;
        }
    }
    resetView() {
        this.canvas?.resetView();
    }
    exportCSV() {
        if (!this.canvas)
            return;
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
    mountCanvas() {
        if (!this.canvasContainer)
            return;
        if (this.canvas) {
            this.canvas.destroy();
        }
        this.canvas = new scope_canvas_1.ScopeCanvas(this.canvasContainer);
        this.canvas.timeWindowSec = this.state.timeWindowSec;
        this.canvas.start();
        this.syncCanvasChannels();
    }
    unmountCanvas() {
        if (this.canvas) {
            this.canvas.stop();
            this.canvas.destroy();
            this.canvas = null;
        }
    }
    syncCanvasChannels() {
        if (!this.canvas)
            return;
        this.canvas.buffer = this.buffer;
        this.canvas.activeChannels = this.state.activeChannels;
    }
    // --- State ---
    setState(partial) {
        this.state = { ...this.state, ...partial };
        this.syncCanvasChannels();
        this.update();
    }
};
exports.ScopeViewWidget = ScopeViewWidget;
ScopeViewWidget.ID = 'audesys.scope-view';
ScopeViewWidget.LABEL = 'Scope View';
__decorate([
    (0, inversify_1.inject)(signal_bridge_protocol_1.SignalBridgeService),
    __metadata("design:type", Object)
], ScopeViewWidget.prototype, "signalBridge", void 0);
__decorate([
    (0, inversify_1.postConstruct)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ScopeViewWidget.prototype, "init", null);
exports.ScopeViewWidget = ScopeViewWidget = ScopeViewWidget_1 = __decorate([
    (0, inversify_1.injectable)(),
    __metadata("design:paramtypes", [])
], ScopeViewWidget);
function toolbarBtnStyle(active) {
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
//# sourceMappingURL=scope-panel-widget.js.map