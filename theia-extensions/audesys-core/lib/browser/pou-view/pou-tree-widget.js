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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var PouTreeWidget_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PouTreeWidget = void 0;
const React = __importStar(require("@theia/core/shared/react"));
const inversify_1 = require("@theia/core/shared/inversify");
const react_widget_1 = require("@theia/core/lib/browser/widgets/react-widget");
const uri_1 = __importDefault(require("@theia/core/lib/common/uri"));
const file_service_1 = require("@theia/filesystem/lib/browser/file-service");
const workspace_service_1 = require("@theia/workspace/lib/browser/workspace-service");
const opener_service_1 = require("@theia/core/lib/browser/opener-service");
const pou_tree_model_1 = require("../pou-tree-model");
/**
 * POU tree widget — lists IEC 61131-3 files grouped by directory convention
 * (Programs / FBs / Functions / GVL) in the left sidebar. Clicking a file opens
 * it via the OpenerService (routes .ld/.fbd to their editors, text to Monaco).
 */
let PouTreeWidget = PouTreeWidget_1 = class PouTreeWidget extends react_widget_1.ReactWidget {
    constructor() {
        super();
        this.expanded = new Set();
        this.state = { groups: [], error: null, loading: false };
        /** Debounced refresh — onDidFilesChange fires on every bulk file op. */
        this.refreshScheduled = false;
        this.id = PouTreeWidget_1.ID;
        this.title.label = PouTreeWidget_1.LABEL;
        this.title.caption = 'IEC 61131-3 Program Organization';
        this.title.closable = true;
        this.title.iconClass = 'fa fa-sitemap';
        this.addClass('audesys-pou-tree');
    }
    init() {
        this.toDispose.push(this.workspaceService.onWorkspaceChanged(() => this.scheduleRefresh()));
        this.toDispose.push(this.fileService.onDidFilesChange(() => this.scheduleRefresh()));
        this.refresh();
    }
    onAfterAttach(msg) {
        super.onAfterAttach(msg);
        this.update();
    }
    render() {
        const { groups, loading, error } = this.state;
        return (React.createElement("div", { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
            this.renderToolbar(loading),
            this.renderError(error),
            this.renderGroups(groups)));
    }
    renderToolbar(loading) {
        return (React.createElement("div", { style: {
                padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6,
                borderBottom: '1px solid var(--theia-sideBar-sectionHeader-border, #383838)',
            } },
            React.createElement("span", { style: { fontSize: 11, color: 'var(--theia-sideBarTitle-foreground)', fontWeight: 600 } }, "Program Organization"),
            React.createElement("span", { style: { fontSize: 10, color: 'var(--theia-descriptionForeground)', marginLeft: 'auto' } }, loading ? 'Scanning…' : `${this.state.groups.reduce((n, g) => n + g.files.length, 0)} files`)));
    }
    renderError(error) {
        if (!error) {
            return null;
        }
        return (React.createElement("div", { style: {
                padding: '4px 8px', color: 'var(--theia-errorForeground)',
                fontSize: 11, background: 'var(--theia-inputValidation-errorBackground)',
            } }, error));
    }
    renderGroups(groups) {
        if (groups.length === 0) {
            return (React.createElement("div", { style: {
                    flex: 1, overflow: 'auto', padding: '12px 8px',
                    color: 'var(--theia-descriptionForeground)', fontSize: 12,
                } }, "No IEC files yet. Open a workspace and create files via File > New > IEC 61131-3."));
        }
        return (React.createElement("div", { style: { flex: 1, overflow: 'auto' } }, groups.map((g) => this.renderGroup(g))));
    }
    renderGroup(group) {
        const isOpen = this.expanded.has(group.id);
        return (React.createElement("div", { key: group.id },
            React.createElement("div", { role: "treeitem", "aria-expanded": isOpen, onClick: () => this.toggleGroup(group.id), style: {
                    padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    color: 'var(--theia-sideBarTitle-foreground)',
                    background: 'var(--theia-sideBar-sectionHeader-background)',
                    borderBottom: '1px solid var(--theia-sideBar-sectionHeader-border, #383838)',
                    display: 'flex', alignItems: 'center', gap: 4,
                } },
                React.createElement("span", { style: { fontSize: 10, width: 12 } }, isOpen ? '\u25BC' : '\u25B6'),
                React.createElement("span", null, group.label),
                React.createElement("span", { style: { fontSize: 10, color: 'var(--theia-descriptionForeground)', marginLeft: 'auto' } }, String(group.files.length))),
            isOpen && group.files.map((file) => this.renderFile(group.id, file))));
    }
    renderFile(groupId, file) {
        return (React.createElement("div", { key: file.uri, role: "treeitem", onClick: () => this.openFile(file), title: file.uri, style: {
                padding: '2px 8px 2px 28px', fontSize: 12, cursor: 'pointer',
                fontFamily: 'var(--theia-editor-font-family, monospace)',
                color: 'var(--theia-foreground)',
                display: 'flex', alignItems: 'center', gap: 6,
                borderBottom: '1px solid var(--theia-sideBar-background)',
            } },
            React.createElement("span", { style: { width: 12, fontSize: 10, color: 'var(--theia-descriptionForeground)' } }, this.iconFor(groupId)),
            React.createElement("span", null, file.name)));
    }
    iconFor(groupId) {
        switch (groupId) {
            case 'GVL': return '\u25A3';
            case 'FBs': return '\u25A2';
            case 'Functions': return '\u0192';
            default: return '\u25A1';
        }
    }
    toggleGroup(id) {
        const next = new Set(this.expanded);
        if (next.has(id)) {
            next.delete(id);
        }
        else {
            next.add(id);
        }
        this.expanded = next;
        this.update();
    }
    async openFile(file) {
        try {
            const uri = new uri_1.default(file.uri);
            const opener = await this.openerService.getOpener(uri);
            await opener.open(uri);
        }
        catch (e) {
            this.setState({ error: `Failed to open ${file.name}: ${String(e)}` });
        }
    }
    scheduleRefresh() {
        if (this.refreshScheduled) {
            return;
        }
        this.refreshScheduled = true;
        setTimeout(() => {
            this.refreshScheduled = false;
            this.refresh();
        }, 150);
    }
    async refresh() {
        const root = this.workspaceService.tryGetRoots()[0]?.resource;
        if (!root) {
            this.setState({ groups: [], error: null, loading: false });
            return;
        }
        this.setState({ loading: true });
        try {
            const files = await this.collectFiles(root);
            this.setState({ groups: (0, pou_tree_model_1.classifyToGroups)(files), error: null, loading: false });
        }
        catch (e) {
            this.setState({ groups: [], error: `Failed to scan workspace: ${String(e)}`, loading: false });
        }
    }
    /** Recursively walk the workspace root collecting plain files. */
    async collectFiles(root) {
        const out = [];
        const stack = [root];
        while (stack.length > 0) {
            const uri = stack.pop();
            const stat = await this.fileService.resolve(uri);
            if (stat.isDirectory) {
                for (const child of stat.children ?? []) {
                    stack.push(child.resource);
                }
            }
            else if (stat.isFile) {
                out.push({ uri: stat.resource.toString(), name: stat.name, ext: (0, pou_tree_model_1.extOf)(stat.name) });
            }
        }
        return out;
    }
    setState(partial) {
        this.state = { ...this.state, ...partial };
        this.update();
    }
};
exports.PouTreeWidget = PouTreeWidget;
PouTreeWidget.ID = 'audesys.pou-tree';
PouTreeWidget.LABEL = 'POU';
__decorate([
    (0, inversify_1.inject)(file_service_1.FileService),
    __metadata("design:type", file_service_1.FileService)
], PouTreeWidget.prototype, "fileService", void 0);
__decorate([
    (0, inversify_1.inject)(workspace_service_1.WorkspaceService),
    __metadata("design:type", workspace_service_1.WorkspaceService)
], PouTreeWidget.prototype, "workspaceService", void 0);
__decorate([
    (0, inversify_1.inject)(opener_service_1.OpenerService),
    __metadata("design:type", Object)
], PouTreeWidget.prototype, "openerService", void 0);
__decorate([
    (0, inversify_1.postConstruct)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PouTreeWidget.prototype, "init", null);
exports.PouTreeWidget = PouTreeWidget = PouTreeWidget_1 = __decorate([
    (0, inversify_1.injectable)(),
    __metadata("design:paramtypes", [])
], PouTreeWidget);
//# sourceMappingURL=pou-tree-widget.js.map