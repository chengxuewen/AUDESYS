"use strict";
/**
 * FBD Editor Contribution — Theia OpenHandler + CommandContribution for .fbd files.
 *
 * Registers:
 * - OpenHandler: opens .fbd files in the FBD editor widget
 * - CommandContribution: Compile, Save, Undo, Redo commands
 * - Wires tool palette selection → editor actions
 *
 * Ponytail: one class, multiple contribution interfaces. Clone of LD pattern.
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FbdEditorCommandContribution = exports.FbdEditorOpenHandler = exports.FBD_EDITOR_COMMANDS = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const core_1 = require("@theia/core");
const common_menus_1 = require("@theia/core/lib/browser/common-menus");
const application_shell_1 = require("@theia/core/lib/browser/shell/application-shell");
const uri_1 = require("@theia/core/lib/common/uri");
const file_service_1 = require("@theia/filesystem/lib/browser/file-service");
const fbd_tool_state_1 = require("../tool-palette/fbd-tool-state");
const fbd_gmodel_state_1 = require("../server/fbd-gmodel-state");
const fbd_operation_handler_1 = require("../server/fbd-operation-handler");
const fbd_editor_widget_1 = require("./fbd-editor-widget");
const serialization_1 = require("../gmodel/serialization");
const model_1 = require("../gmodel/model");
// ============================================================================
// Commands
// ============================================================================
exports.FBD_EDITOR_COMMANDS = {
    COMPILE: {
        id: 'audesys.fbd.compile',
        label: 'FBD: Compile',
        category: 'Function Block Diagram',
    },
    SAVE: {
        id: 'audesys.fbd.save',
        label: 'FBD: Save',
        category: 'Function Block Diagram',
    },
    UNDO: {
        id: 'audesys.fbd.undo',
        label: 'FBD: Undo',
    },
    REDO: {
        id: 'audesys.fbd.redo',
        label: 'FBD: Redo',
    },
};
// ============================================================================
// FbdEditorOpenHandler
// ============================================================================
let FbdEditorOpenHandler = class FbdEditorOpenHandler {
    constructor(shell, toolState, modelState, handler, fileService) {
        this.shell = shell;
        this.toolState = toolState;
        this.modelState = modelState;
        this.handler = handler;
        this.fileService = fileService;
        this.id = 'audesys-fbd-editor-handler';
        this.editors = new Map();
    }
    canHandle(uri) {
        if (uri.path.ext === '.fbd') {
            return 1000;
        }
        return 0;
    }
    async open(uri) {
        // Reuse existing editor
        const existing = this.editors.get(uri.toString());
        if (existing) {
            await this.shell.activateWidget(existing.id);
            return existing;
        }
        // Read file content
        let graph;
        try {
            const content = await this.fileService.read(uri);
            graph = (0, serialization_1.fromJSON)(content.value);
        }
        catch {
            // New file — create empty graph
            graph = (0, model_1.createFbdGraph)();
        }
        // Create fresh model state
        this.modelState.applyOperation(() => graph);
        this.modelState.markClean();
        // Create editor widget
        const widget = new fbd_editor_widget_1.FbdEditorWidget(this.toolState, this.modelState, this.handler);
        widget.title.label = uri.displayName;
        widget.title.caption = uri.path.toString();
        widget.title.closable = true;
        widget.setSelectionCallback((sel) => {
            // Future: publish to property view via SelectionService
        });
        await this.shell.addWidget(widget, { area: 'main' });
        await this.shell.activateWidget(widget.id);
        this.editors.set(uri.toString(), widget);
        widget.disposed.connect(() => {
            this.editors.delete(uri.toString());
        });
        return widget;
    }
    /** Get the currently active FBD editor widget. */
    getActiveEditor() {
        for (const w of this.editors.values()) {
            if (w.isVisible)
                return w;
        }
        return undefined;
    }
};
exports.FbdEditorOpenHandler = FbdEditorOpenHandler;
exports.FbdEditorOpenHandler = FbdEditorOpenHandler = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)(application_shell_1.ApplicationShell)),
    __param(1, (0, inversify_1.inject)(fbd_tool_state_1.FbdToolState)),
    __param(2, (0, inversify_1.inject)(fbd_gmodel_state_1.FbdGModelState)),
    __param(3, (0, inversify_1.inject)(fbd_operation_handler_1.FbdOperationHandler)),
    __param(4, (0, inversify_1.inject)(file_service_1.FileService)),
    __metadata("design:paramtypes", [application_shell_1.ApplicationShell,
        fbd_tool_state_1.FbdToolState,
        fbd_gmodel_state_1.FbdGModelState,
        fbd_operation_handler_1.FbdOperationHandler,
        file_service_1.FileService])
], FbdEditorOpenHandler);
// ============================================================================
// FbdEditorCommandContribution
// ============================================================================
let FbdEditorCommandContribution = class FbdEditorCommandContribution {
    constructor(openHandler, modelState, operationHandler, messageService, fileService) {
        this.openHandler = openHandler;
        this.modelState = modelState;
        this.operationHandler = operationHandler;
        this.messageService = messageService;
        this.fileService = fileService;
    }
    registerCommands(registry) {
        registry.registerCommand(exports.FBD_EDITOR_COMMANDS.COMPILE, {
            execute: () => this.compile(),
        });
        registry.registerCommand(exports.FBD_EDITOR_COMMANDS.SAVE, {
            execute: () => this.save(),
        });
        registry.registerCommand(exports.FBD_EDITOR_COMMANDS.UNDO, {
            execute: () => this.undo(),
            isEnabled: () => this.modelState.canUndo,
        });
        registry.registerCommand(exports.FBD_EDITOR_COMMANDS.REDO, {
            execute: () => this.redo(),
            isEnabled: () => this.modelState.canRedo,
        });
    }
    registerMenus(menus) {
        menus.registerMenuAction(common_menus_1.CommonMenus.EDIT, {
            commandId: exports.FBD_EDITOR_COMMANDS.COMPILE.id,
            label: 'FBD: Compile',
            order: 'z',
        });
        menus.registerMenuAction(common_menus_1.CommonMenus.EDIT, {
            commandId: exports.FBD_EDITOR_COMMANDS.UNDO.id,
            label: 'FBD: Undo',
            order: 'z1',
        });
        menus.registerMenuAction(common_menus_1.CommonMenus.EDIT, {
            commandId: exports.FBD_EDITOR_COMMANDS.REDO.id,
            label: 'FBD: Redo',
            order: 'z2',
        });
    }
    // ── Compile ────────────────────────────────────────────────
    compile() {
        const graph = this.modelState.graph;
        const result = this.operationHandler.compile(graph);
        if (result.success) {
            this.modelState.markClean();
            this.messageService.info('Compilation successful!\n\n' +
                `Output size: ${result.programJson.length} bytes`);
        }
        else {
            const diag = result.diagnostics
                .map((d) => `[${d.severity}] ${d.message} (${d.code})`)
                .join('\n');
            this.messageService.error(`Compilation failed with ${result.diagnostics.length} error(s):\n\n${diag}`);
        }
    }
    // ── Save ───────────────────────────────────────────────────
    async save() {
        const editor = this.openHandler.getActiveEditor();
        if (!editor) {
            this.messageService.warn('No active FBD editor to save');
            return;
        }
        const uriPath = editor.title.caption;
        if (!uriPath) {
            this.messageService.warn('Editor has no file path');
            return;
        }
        try {
            const graph = this.modelState.graph;
            const json = (0, serialization_1.toJSON)(graph);
            const uri = new uri_1.URI(uriPath);
            await this.fileService.write(uri, json);
            this.modelState.markClean();
            this.messageService.info(`Saved: ${uri.displayName}`);
        }
        catch (err) {
            this.messageService.error(`Failed to save: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    // ── Undo / Redo ────────────────────────────────────────────
    undo() {
        this.modelState.undo();
    }
    redo() {
        this.modelState.redo();
    }
};
exports.FbdEditorCommandContribution = FbdEditorCommandContribution;
exports.FbdEditorCommandContribution = FbdEditorCommandContribution = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)(FbdEditorOpenHandler)),
    __param(1, (0, inversify_1.inject)(fbd_gmodel_state_1.FbdGModelState)),
    __param(2, (0, inversify_1.inject)(fbd_operation_handler_1.FbdOperationHandler)),
    __param(3, (0, inversify_1.inject)(core_1.MessageService)),
    __param(4, (0, inversify_1.inject)(file_service_1.FileService)),
    __metadata("design:paramtypes", [FbdEditorOpenHandler,
        fbd_gmodel_state_1.FbdGModelState,
        fbd_operation_handler_1.FbdOperationHandler,
        core_1.MessageService,
        file_service_1.FileService])
], FbdEditorCommandContribution);
//# sourceMappingURL=fbd-editor-contribution.js.map