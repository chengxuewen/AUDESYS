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
var SignalBrowserWidget_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalBrowserWidget = void 0;
const React = __importStar(require("react"));
const inversify_1 = require("@theia/core/shared/inversify");
const react_widget_1 = require("@theia/core/lib/browser/widgets/react-widget");
const signal_bridge_protocol_1 = require("../../common/signal-bridge-protocol");
const signal_tree_model_1 = require("./signal-tree-model");
/**
 * Signal Browser Widget — live controller signal viewer with tree grouping.
 */
let SignalBrowserWidget = SignalBrowserWidget_1 = class SignalBrowserWidget extends react_widget_1.ReactWidget {
    constructor() {
        super();
        this.treeModel = new signal_tree_model_1.SignalTreeModel();
        this.pollTimer = null;
        this.state = {
            signals: [],
            pattern: '*',
            polling: false,
            count: 0,
            error: null,
        };
        this.id = SignalBrowserWidget_1.ID;
        this.title.label = SignalBrowserWidget_1.LABEL;
        this.title.caption = 'Live controller signal monitor';
        this.title.closable = true;
        this.title.iconClass = 'fa fa-signal';
        this.addClass('audesys-signal-browser');
    }
    init() {
        this.update();
    }
    onAfterAttach(msg) {
        super.onAfterAttach(msg);
        this.startPolling();
    }
    onBeforeDetach(msg) {
        this.stopPolling();
        super.onBeforeDetach(msg);
    }
    onAfterHide(_msg) {
        this.stopPolling();
    }
    render() {
        const { signals, pattern, polling } = this.state;
        this.treeModel.update(signal_tree_model_1.SignalTreeModel.filter(signals, pattern));
        const groups = this.treeModel.getGroups();
        return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } }, this.renderToolbar(pattern, polling), this.renderError(), this.renderTree(groups), this.renderStatusBar());
    }
    renderToolbar(pattern, polling) {
        return React.createElement('div', {
            style: {
                padding: '4px 6px', display: 'flex', gap: 4, alignItems: 'center',
                borderBottom: '1px solid var(--theia-sideBar-sectionHeader-border, #383838)',
            },
        }, React.createElement('input', {
            type: 'text',
            value: pattern,
            onChange: (e) => this.setState({ pattern: e.target.value }),
            style: {
                flex: 1, fontSize: 12, padding: '2px 6px',
                border: '1px solid var(--theia-input-border)',
                background: 'var(--theia-input-background)',
                color: 'var(--theia-input-foreground)',
                borderRadius: 2,
                fontFamily: 'var(--theia-ui-font-family)',
            },
            placeholder: 'axis.*',
        }), !polling
            ? React.createElement('button', {
                onClick: () => this.startPolling(),
                style: { fontSize: 11, padding: '2px 6px', whiteSpace: 'nowrap' },
            }, 'Start')
            : React.createElement('button', {
                onClick: () => this.stopPolling(),
                style: { fontSize: 11, padding: '2px 6px', whiteSpace: 'nowrap' },
            }, 'Stop'));
    }
    renderError() {
        const { error } = this.state;
        if (!error)
            return null;
        return React.createElement('div', {
            style: {
                padding: '4px 8px', color: 'var(--theia-errorForeground)',
                fontSize: 11, background: 'var(--theia-inputValidation-errorBackground)',
            },
        }, error);
    }
    renderTree(groups) {
        if (groups.length === 0) {
            return React.createElement('div', {
                style: {
                    flex: 1, overflow: 'auto', padding: '12px 8px',
                    color: 'var(--theia-descriptionForeground)', fontSize: 12,
                },
            }, this.state.polling ? 'Waiting for signals...' : 'Click Start to begin polling.');
        }
        return React.createElement('div', { style: { flex: 1, overflow: 'auto' } }, ...groups.map(g => this.renderGroup(g)));
    }
    renderGroup(g) {
        return React.createElement('div', { key: g.namespace }, this.renderGroupHeader(g), g.expanded && g.signals.map(s => React.createElement('div', {
            key: s.name,
            style: {
                padding: '2px 8px 2px 28px', fontSize: 12,
                fontFamily: 'var(--theia-editor-font-family, monospace)',
                color: 'var(--theia-foreground)',
                display: 'flex', justifyContent: 'space-between',
                borderBottom: '1px solid var(--theia-sideBar-background)',
            },
        }, React.createElement('span', null, s.name), React.createElement('span', {
            style: { color: 'var(--theia-debugIcon-startForeground)', marginLeft: 12 },
        }, s.value))));
    }
    renderGroupHeader(g) {
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
        }, React.createElement('span', { style: { fontSize: 10, width: 12 } }, g.expanded ? '\u25BC' : '\u25B6'), g.namespace, React.createElement('span', {
            style: { fontSize: 10, color: 'var(--theia-descriptionForeground)', marginLeft: 'auto' },
        }, String(g.signals.length)));
    }
    renderStatusBar() {
        const { polling, count, signals } = this.state;
        return React.createElement('div', {
            style: {
                padding: '2px 8px', fontSize: 10,
                color: 'var(--theia-descriptionForeground)',
                borderTop: '1px solid var(--theia-sideBar-sectionHeader-border, #383838)',
                display: 'flex', justifyContent: 'space-between',
            },
        }, React.createElement('span', null, polling ? `\u25CF Live (${count})` : '\u25CB Idle'), React.createElement('span', null, `${this.treeModel.getGroups().length} groups, ${signals.length} signals`));
    }
    async fetchSignals() {
        try {
            const signals = await this.signalBridge.signalSnapshot(this.state.pattern);
            this.setState({ signals, count: this.state.count + 1, error: null });
        }
        catch (_err) {
            // ponytail: controller may not respond every tick; only show first error
            if (!this.state.error) {
                this.setState({ error: 'Controller unreachable. Check connection.' });
            }
        }
    }
    startPolling() {
        if (this.state.polling)
            return;
        this.setState({ polling: true });
        this.fetchSignals();
        // ponytail: 500ms interval, fine for dev; push mode later
        this.pollTimer = setInterval(() => { this.fetchSignals(); }, 500);
    }
    stopPolling() {
        this.setState({ polling: false });
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }
    toggleGroup(namespace) {
        this.treeModel.toggleGroup(namespace);
        this.update();
    }
    setState(partial) {
        this.state = { ...this.state, ...partial };
        this.update();
    }
};
exports.SignalBrowserWidget = SignalBrowserWidget;
SignalBrowserWidget.ID = 'audesys.signal-browser';
SignalBrowserWidget.LABEL = 'Signal Browser';
__decorate([
    (0, inversify_1.inject)(signal_bridge_protocol_1.SignalBridgeService),
    __metadata("design:type", Object)
], SignalBrowserWidget.prototype, "signalBridge", void 0);
__decorate([
    (0, inversify_1.postConstruct)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SignalBrowserWidget.prototype, "init", null);
exports.SignalBrowserWidget = SignalBrowserWidget = SignalBrowserWidget_1 = __decorate([
    (0, inversify_1.injectable)(),
    __metadata("design:paramtypes", [])
], SignalBrowserWidget);
//# sourceMappingURL=signal-browser-widget.js.map