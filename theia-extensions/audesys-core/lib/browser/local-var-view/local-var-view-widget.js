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
var LocalVarViewWidget_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalVarViewWidget = void 0;
const React = __importStar(require("@theia/core/shared/react"));
const inversify_1 = require("@theia/core/shared/inversify");
const react_widget_1 = require("@theia/core/lib/browser/widgets/react-widget");
const uri_1 = __importDefault(require("@theia/core/lib/common/uri"));
const browser_1 = require("@theia/editor/lib/browser");
const file_service_1 = require("@theia/filesystem/lib/browser/file-service");
const buffer_1 = require("@theia/core/lib/common/buffer");
const local_var_model_1 = require("../local-var-model");
const var_reference_model_1 = require("../var-reference-model");
/** File extensions that expose a local-variable table. */
const LOCAL_VAR_EXTS = ['.st', '.il'];
const EMPTY_STATE = {
    uri: null,
    fileName: null,
    originalText: '',
    vars: [],
    error: null,
    loading: false,
    dirty: false,
};
/**
 * Local Variables panel — follows the active editor. When a `.st`/`.il` POU
 * file is open it shows the `VAR` block variables in a table with inline
 * editing (name / type dropdown / init / comment) and a Save button that
 * writes the serialized block back into the file, preserving all other code.
 */
let LocalVarViewWidget = LocalVarViewWidget_1 = class LocalVarViewWidget extends react_widget_1.ReactWidget {
    constructor() {
        super();
        this.state = { ...EMPTY_STATE };
        this.id = LocalVarViewWidget_1.ID;
        this.title.label = LocalVarViewWidget_1.LABEL;
        this.title.caption = 'Local variable editor';
        this.title.closable = true;
        this.title.iconClass = 'fa fa-table';
        this.addClass('audesys-local-var-view');
    }
    init() {
        this.toDispose.push(this.editorManager.onActiveEditorChanged((w) => this.handleActiveEditor(w)));
        this.handleActiveEditor(this.editorManager.activeEditor);
    }
    onAfterAttach(msg) {
        super.onAfterAttach(msg);
        this.update();
    }
    render() {
        const { uri, fileName, vars, error, loading, dirty } = this.state;
        return (React.createElement("div", { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
            this.renderToolbar(fileName, vars.length, dirty, loading),
            this.renderError(error),
            this.renderBody(uri, vars),
            this.renderUndeclaredRefs(uri)));
    }
    renderToolbar(fileName, count, dirty, loading) {
        return (React.createElement("div", { style: {
                padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6,
                borderBottom: '1px solid var(--theia-sideBar-sectionHeader-border, #383838)',
            } },
            React.createElement("span", { style: { fontSize: 11, color: 'var(--theia-sideBarTitle-foreground)', fontWeight: 600 } }, fileName ?? 'Local Variables'),
            React.createElement("span", { style: { fontSize: 10, color: 'var(--theia-descriptionForeground)', marginLeft: 'auto' } }, loading ? 'Loading…' : `${count} vars`),
            React.createElement("button", { style: { fontSize: 11, padding: '2px 8px' }, onClick: () => this.addVar(), disabled: !this.state.uri, title: "Add a variable row" }, "+ Add"),
            React.createElement("button", { style: { fontSize: 11, padding: '2px 8px', fontWeight: dirty ? 700 : undefined }, onClick: () => this.save(), disabled: !dirty, title: "Write changes back to the file" }, "Save")));
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
    renderBody(uri, vars) {
        if (!uri) {
            return (React.createElement("div", { style: {
                    flex: 1, overflow: 'auto', padding: '12px 8px',
                    color: 'var(--theia-descriptionForeground)', fontSize: 12,
                } }, "Open a .st or .il program file to edit local variables."));
        }
        return (React.createElement("div", { style: { flex: 1, overflow: 'auto', padding: 4 } },
            React.createElement("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 12 } },
                React.createElement("thead", null,
                    React.createElement("tr", { style: { color: 'var(--theia-descriptionForeground)', textAlign: 'left' } },
                        React.createElement("th", { style: thStyle }, "Name"),
                        React.createElement("th", { style: thStyle }, "Type"),
                        React.createElement("th", { style: thStyle }, "Init"),
                        React.createElement("th", { style: thStyle }, "Comment"),
                        React.createElement("th", { style: { ...thStyle, width: 24 } }))),
                React.createElement("tbody", null, vars.map((v, i) => this.renderRow(v, i))))));
    }
    /** Code-referenced-but-undeclared names (A2-4 hint). Non-blocking. */
    renderUndeclaredRefs(uri) {
        if (!uri || this.state.originalText === '') {
            return null;
        }
        const declared = this.state.vars.map((v) => v.name.trim()).filter((n) => n !== '');
        const code = (0, var_reference_model_1.extractProgramBody)(this.state.originalText);
        const undeclared = (0, var_reference_model_1.findUndeclaredRefs)(code, declared);
        if (undeclared.length === 0) {
            return null;
        }
        return (React.createElement("div", { style: {
                padding: '6px 8px',
                borderTop: '1px solid var(--theia-sideBar-sectionHeader-border, #383838)',
            } },
            React.createElement("div", { style: { fontSize: 10, color: 'var(--theia-warningForeground)', fontWeight: 600 } }, "Code references but not declared:"),
            React.createElement("div", { style: {
                    maxHeight: 120, overflow: 'auto', marginTop: 2,
                    fontSize: 11,
                    color: 'var(--theia-descriptionForeground)',
                    fontFamily: 'var(--theia-editor-font-family, monospace)',
                } }, undeclared.join('  '))));
    }
    renderRow(v, index) {
        // Keep the current type visible in the dropdown even if it is not in
        // the A2-3 subset (e.g. WORD from an existing file).
        const typeOptions = local_var_model_1.LOCAL_TYPES.includes(v.type) ? local_var_model_1.LOCAL_TYPES : [...local_var_model_1.LOCAL_TYPES, v.type];
        return (React.createElement("tr", { key: index, style: { verticalAlign: 'top' } },
            React.createElement("td", { style: tdStyle },
                React.createElement("input", { style: inputStyle, value: v.name, placeholder: "name", spellCheck: false, onChange: (e) => this.updateVar(index, { name: e.target.value }) })),
            React.createElement("td", { style: tdStyle },
                React.createElement("select", { style: { ...inputStyle, width: '100%' }, value: v.type, onChange: (e) => this.updateVar(index, { type: e.target.value }) }, typeOptions.map((t) => React.createElement("option", { key: t, value: t }, t)))),
            React.createElement("td", { style: tdStyle },
                React.createElement("input", { style: inputStyle, value: v.init, placeholder: "0", spellCheck: false, onChange: (e) => this.updateVar(index, { init: e.target.value }) })),
            React.createElement("td", { style: tdStyle },
                React.createElement("input", { style: inputStyle, value: v.comment, placeholder: "\u2014", spellCheck: false, onChange: (e) => this.updateVar(index, { comment: e.target.value }) })),
            React.createElement("td", { style: tdStyle },
                React.createElement("button", { style: { fontSize: 11, padding: '0 6px', cursor: 'pointer' }, title: "Remove this variable", onClick: () => this.removeVar(index) }, "\u2715"))));
    }
    handleActiveEditor(widget) {
        const uri = widget?.editor.uri.toString() ?? '';
        const isLocalVarFile = LOCAL_VAR_EXTS.some((ext) => uri.toLowerCase().endsWith(ext));
        if (!isLocalVarFile) {
            if (this.state.uri !== null) {
                this.setState({ ...EMPTY_STATE });
            }
            return;
        }
        if (uri === this.state.uri) {
            return;
        }
        this.setState({ uri, fileName: new uri_1.default(uri).path.base ?? null, loading: true, error: null });
        this.loadVars(uri);
    }
    async loadVars(uri) {
        try {
            const stat = await this.fileService.readFile(new uri_1.default(uri));
            const text = stat.value.toString();
            this.setState({ originalText: text, vars: (0, local_var_model_1.parseLocalVars)(text), loading: false, dirty: false });
        }
        catch (e) {
            this.setState({ vars: [], loading: false, error: `Failed to read file: ${String(e)}` });
        }
    }
    async save() {
        const { uri, originalText, vars } = this.state;
        if (!uri) {
            return;
        }
        // Drop rows with no name — they serialize to invalid declarations.
        const valid = vars.filter((v) => v.name.trim() !== '');
        try {
            const next = (0, local_var_model_1.serializeLocalVars)(originalText, valid);
            await this.fileService.writeFile(new uri_1.default(uri), buffer_1.BinaryBuffer.fromString(next));
            this.setState({ originalText: next, vars: valid, dirty: false, error: null });
        }
        catch (e) {
            this.setState({ error: `Failed to save: ${String(e)}` });
        }
    }
    updateVar(index, patch) {
        const vars = this.state.vars.map((v, i) => (i === index ? { ...v, ...patch } : v));
        this.setState({ vars, dirty: true });
    }
    addVar() {
        this.setState({
            vars: [...this.state.vars, { name: '', type: 'BOOL', init: '', comment: '' }],
            dirty: true,
        });
    }
    removeVar(index) {
        const vars = this.state.vars.filter((_, i) => i !== index);
        this.setState({ vars, dirty: true });
    }
    setState(partial) {
        this.state = { ...this.state, ...partial };
        this.update();
    }
};
exports.LocalVarViewWidget = LocalVarViewWidget;
LocalVarViewWidget.ID = 'audesys.local-var-view';
LocalVarViewWidget.LABEL = 'Local Variables';
__decorate([
    (0, inversify_1.inject)(file_service_1.FileService),
    __metadata("design:type", file_service_1.FileService)
], LocalVarViewWidget.prototype, "fileService", void 0);
__decorate([
    (0, inversify_1.inject)(browser_1.EditorManager),
    __metadata("design:type", browser_1.EditorManager)
], LocalVarViewWidget.prototype, "editorManager", void 0);
__decorate([
    (0, inversify_1.postConstruct)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LocalVarViewWidget.prototype, "init", null);
exports.LocalVarViewWidget = LocalVarViewWidget = LocalVarViewWidget_1 = __decorate([
    (0, inversify_1.injectable)(),
    __metadata("design:paramtypes", [])
], LocalVarViewWidget);
const thStyle = {
    padding: '2px 4px',
    borderBottom: '1px solid var(--theia-sideBar-sectionHeader-border, #383838)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
};
const tdStyle = {
    padding: '2px 4px',
    borderBottom: '1px solid var(--theia-sideBar-background)',
};
const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    fontSize: 12,
    fontFamily: 'var(--theia-editor-font-family, monospace)',
    background: 'var(--theia-input-background)',
    color: 'var(--theia-input-foreground)',
    border: '1px solid var(--theia-input-border, #3f3f3f)',
    borderRadius: 2,
    padding: '1px 4px',
};
//# sourceMappingURL=local-var-view-widget.js.map