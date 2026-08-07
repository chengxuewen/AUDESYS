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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StCompileCommandContribution = exports.ST_COMPILE_PROJECT_COMMAND = exports.ST_COMPILE_COMMAND = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const browser_1 = require("@theia/editor/lib/browser");
const browser_2 = require("@theia/core/lib/browser");
const common_1 = require("@theia/core/lib/common");
const monaco = __importStar(require("@theia/monaco-editor-core"));
const uri_1 = __importDefault(require("@theia/core/lib/common/uri"));
const file_service_1 = require("@theia/filesystem/lib/browser/file-service");
const workspace_service_1 = require("@theia/workspace/lib/browser/workspace-service");
const st_compile_protocol_1 = require("../common/st-compile-protocol");
const st_project_compile_1 = require("./st-project-compile");
exports.ST_COMPILE_COMMAND = {
    id: 'audesys-st.compile',
    label: 'Compile (ST→HalProgram)',
    category: 'ST',
};
exports.ST_COMPILE_PROJECT_COMMAND = {
    id: 'audesys-st.compile-project',
    label: 'Compile Project (All POU files)',
    category: 'ST',
};
const SEVERITY = {
    Error: monaco.MarkerSeverity.Error,
    Warning: monaco.MarkerSeverity.Warning,
    Info: monaco.MarkerSeverity.Info,
    Hint: monaco.MarkerSeverity.Hint,
};
let StCompileCommandContribution = class StCompileCommandContribution {
    constructor() {
        this.compileServer = null;
    }
    onStart(_app) {
        this.compileServer = this.connectionProvider.createProxy(st_compile_protocol_1.StCompileServicePath);
    }
    registerCommands(commands) {
        commands.registerCommand(exports.ST_COMPILE_COMMAND, {
            execute: () => this.compileActiveEditor(),
            isEnabled: () => this.isActiveStEditor(),
        });
        commands.registerCommand(exports.ST_COMPILE_PROJECT_COMMAND, {
            execute: () => this.compileProject(),
        });
    }
    registerKeybindings(bindings) {
        bindings.registerKeybinding({ command: exports.ST_COMPILE_COMMAND.id, keybinding: 'f7' });
        bindings.registerKeybinding({ command: exports.ST_COMPILE_PROJECT_COMMAND.id, keybinding: 'f6' });
    }
    isActiveStEditor() {
        const w = this.editorManager.currentEditor;
        return !!w && w.editor.document.languageId === 'st';
    }
    async compileActiveEditor() {
        const widget = this.editorManager.currentEditor;
        if (!widget || !this.compileServer) {
            return;
        }
        const source = widget.editor.document.getText();
        try {
            // JSON-RPC proxy returns a Promise even though the interface
            // declares `string` — must await so compile errors (rejected
            // promise) are caught here, not as an unhandled rejection.
            await this.compileServer.compileSt(source);
            this.setMarkers(widget, []);
            await this.messageService.info('ST compile OK');
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            const pos = (0, st_project_compile_1.parsePosition)(msg);
            const markers = [{
                    line: pos ? pos.line : 1,
                    column: pos ? pos.column : 1,
                    message: msg,
                    severity: 'Error',
                }];
            this.setMarkers(widget, markers);
            await this.messageService.error(msg);
        }
    }
    async compileProject() {
        const root = this.workspaceService.tryGetRoots()[0]?.resource;
        if (!this.compileServer) {
            return;
        }
        if (!root) {
            await this.messageService.warn('Open a workspace first to compile the project.');
            return;
        }
        const programs = await this.collectPouSources(root);
        if (programs.length === 0) {
            await this.messageService.info('No .st/.il files found in the workspace.');
            return;
        }
        const result = await this.compileServer.compileProject(programs);
        const markersByPath = (0, st_project_compile_1.mapProjectResultToMarkers)(result);
        const errors = result.results.filter((r) => !r.ok);
        for (const r of errors) {
            await this.openAndMark(r.path, markersByPath.get(r.path) ?? []);
        }
        this.clearOkMarkers(result.results);
        if (errors.length === 0) {
            await this.messageService.info(`Compile OK: ${programs.length} file(s)`);
        }
        else {
            await this.messageService.error(`Compile failed: ${errors.length}/${programs.length} file(s) with errors`);
        }
    }
    /** Recursively collect every .st/.il file under the workspace root. */
    async collectPouSources(root) {
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
                const name = stat.name.toLowerCase();
                if (name.endsWith('.st') || name.endsWith('.il')) {
                    const content = await this.fileService.readFile(stat.resource);
                    out.push({ path: stat.resource.toString(), source: content.value.toString() });
                }
            }
        }
        return out.sort((a, b) => a.path.localeCompare(b.path));
    }
    /** Open a failing file and set its markers (so the Problems panel shows them). */
    async openAndMark(uriString, markers) {
        try {
            const widget = await this.editorManager.open(new uri_1.default(uriString));
            this.setMarkers(widget, markers);
        }
        catch (e) {
            await this.messageService.error(`Failed to open ${uriString}: ${String(e)}`);
        }
    }
    /** Clear compile markers on any open model that compiled successfully. */
    clearOkMarkers(results) {
        const okByPath = new Set(results.filter((r) => r.ok).map((r) => r.path));
        for (const model of monaco.editor.getModels()) {
            if (okByPath.has(model.uri.toString())) {
                monaco.editor.setModelMarkers(model, 'audesys-st', []);
            }
        }
    }
    /** Set Monaco markers on a widget's underlying ITextModel. */
    setMarkers(widget, markers) {
        const editor = widget.editor;
        const control = editor.getControl?.();
        const model = control?.getModel();
        if (!model) {
            return;
        }
        monaco.editor.setModelMarkers(model, 'audesys-st', markers.map((mk) => ({
            startLineNumber: mk.line,
            startColumn: mk.column,
            endLineNumber: mk.line,
            endColumn: 2000,
            message: mk.message,
            severity: SEVERITY[mk.severity],
        })));
    }
};
exports.StCompileCommandContribution = StCompileCommandContribution;
__decorate([
    (0, inversify_1.inject)(browser_1.EditorManager),
    __metadata("design:type", browser_1.EditorManager)
], StCompileCommandContribution.prototype, "editorManager", void 0);
__decorate([
    (0, inversify_1.inject)(browser_2.WebSocketConnectionProvider),
    __metadata("design:type", browser_2.WebSocketConnectionProvider)
], StCompileCommandContribution.prototype, "connectionProvider", void 0);
__decorate([
    (0, inversify_1.inject)(common_1.MessageService),
    __metadata("design:type", common_1.MessageService)
], StCompileCommandContribution.prototype, "messageService", void 0);
__decorate([
    (0, inversify_1.inject)(file_service_1.FileService),
    __metadata("design:type", file_service_1.FileService)
], StCompileCommandContribution.prototype, "fileService", void 0);
__decorate([
    (0, inversify_1.inject)(workspace_service_1.WorkspaceService),
    __metadata("design:type", workspace_service_1.WorkspaceService)
], StCompileCommandContribution.prototype, "workspaceService", void 0);
exports.StCompileCommandContribution = StCompileCommandContribution = __decorate([
    (0, inversify_1.injectable)()
], StCompileCommandContribution);
//# sourceMappingURL=st-compile-command.js.map