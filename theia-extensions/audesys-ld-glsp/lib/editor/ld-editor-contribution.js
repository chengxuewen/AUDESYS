"use strict";
/**
 * LD Editor Contribution — Theia OpenHandler + CommandContribution for .ld files.
 *
 * Registers:
 * - OpenHandler: opens .ld files in the LD editor widget
 * - CommandContribution: Compile, Save, Undo, Redo toolbar commands
 * - Wires tool palette selection → editor actions
 *
 * Ponytail: one class, multiple contribution interfaces. No separate handler classes.
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
exports.LdEditorCommandContribution = exports.LdEditorOpenHandler = exports.LD_EDITOR_COMMANDS = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const core_1 = require("@theia/core");
const common_menus_1 = require("@theia/core/lib/browser/common-menus");
const application_shell_1 = require("@theia/core/lib/browser/shell/application-shell");
const uri_1 = require("@theia/core/lib/common/uri");
const file_service_1 = require("@theia/filesystem/lib/browser/file-service");
const ld_tool_state_1 = require("../tool-palette/ld-tool-state");
const ld_gmodel_state_1 = require("../server/ld-gmodel-state");
const ld_operation_handler_1 = require("../server/ld-operation-handler");
const ld_editor_widget_1 = require("./ld-editor-widget");
const serialization_1 = require("../gmodel/serialization");
// ============================================================================
// Commands
// ============================================================================
exports.LD_EDITOR_COMMANDS = {
    COMPILE: {
        id: 'audesys.ld.compile',
        label: 'LD: Compile',
        category: 'Ladder Diagram',
    },
    SAVE: {
        id: 'audesys.ld.save',
        label: 'LD: Save',
        category: 'Ladder Diagram',
    },
    UNDO: {
        id: 'audesys.ld.undo',
        label: 'LD: Undo',
    },
    REDO: {
        id: 'audesys.ld.redo',
        label: 'LD: Redo',
    },
    ADD_RUNG: {
        id: 'audesys.ld.addRung',
        label: 'LD: Add Rung',
    },
};
// ============================================================================
// LdEditorOpenHandler
// ============================================================================
let LdEditorOpenHandler = class LdEditorOpenHandler {
    constructor(shell, toolState, modelState, handler, fileService) {
        this.shell = shell;
        this.toolState = toolState;
        this.modelState = modelState;
        this.handler = handler;
        this.fileService = fileService;
        this.id = 'audesys-ld-editor-handler';
        // Track which widget is currently open for which URI
        this.editors = new Map();
    }
    canHandle(uri) {
        if (uri.path.ext === '.ld') {
            return 1000; // High priority for .ld files
        }
        return 0;
    }
    async open(uri) {
        // Reuse existing editor if already open for this URI
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
            const { createLdGraph } = require('../gmodel/model');
            graph = createLdGraph();
        }
        // Create fresh model state with loaded graph
        this.modelState.applyOperation(() => graph);
        this.modelState.markClean();
        // Create editor widget
        const widget = new ld_editor_widget_1.LdEditorWidget(this.toolState, this.modelState, this.handler);
        widget.title.label = uri.displayName;
        widget.title.caption = uri.path.toString();
        widget.title.closable = true;
        // Wire selection changes
        widget.setSelectionCallback((sel) => {
            // Future: publish to property view via SelectionService
        });
        // Add to main area
        await this.shell.addWidget(widget, { area: 'main' });
        await this.shell.activateWidget(widget.id);
        this.editors.set(uri.toString(), widget);
        // Clean up map when widget is closed
        widget.disposed.connect(() => {
            this.editors.delete(uri.toString());
        });
        return widget;
    }
    /** Get the currently active LD editor widget. */
    getActiveEditor() {
        for (const w of this.editors.values()) {
            if (w.isVisible)
                return w;
        }
        return undefined;
    }
};
exports.LdEditorOpenHandler = LdEditorOpenHandler;
exports.LdEditorOpenHandler = LdEditorOpenHandler = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)(application_shell_1.ApplicationShell)),
    __param(1, (0, inversify_1.inject)(ld_tool_state_1.LdToolState)),
    __param(2, (0, inversify_1.inject)(ld_gmodel_state_1.LdGModelState)),
    __param(3, (0, inversify_1.inject)(ld_operation_handler_1.LdOperationHandler)),
    __param(4, (0, inversify_1.inject)(file_service_1.FileService)),
    __metadata("design:paramtypes", [application_shell_1.ApplicationShell,
        ld_tool_state_1.LdToolState,
        ld_gmodel_state_1.LdGModelState,
        ld_operation_handler_1.LdOperationHandler,
        file_service_1.FileService])
], LdEditorOpenHandler);
// ============================================================================
// LdEditorCommandContribution
// ============================================================================
let LdEditorCommandContribution = class LdEditorCommandContribution {
    constructor(openHandler, modelState, operationHandler, messageService, fileService) {
        this.openHandler = openHandler;
        this.modelState = modelState;
        this.operationHandler = operationHandler;
        this.messageService = messageService;
        this.fileService = fileService;
    }
    registerCommands(registry) {
        // Compile
        registry.registerCommand(exports.LD_EDITOR_COMMANDS.COMPILE, {
            execute: () => this.compile(),
        });
        // Save
        registry.registerCommand(exports.LD_EDITOR_COMMANDS.SAVE, {
            execute: () => this.save(),
        });
        // Undo
        registry.registerCommand(exports.LD_EDITOR_COMMANDS.UNDO, {
            execute: () => this.undo(),
            isEnabled: () => this.modelState.undoDepth > 0,
        });
        // Redo
        registry.registerCommand(exports.LD_EDITOR_COMMANDS.REDO, {
            execute: () => this.redo(),
            isEnabled: () => this.modelState.redoDepth > 0,
        });
        // Add Rung
        registry.registerCommand(exports.LD_EDITOR_COMMANDS.ADD_RUNG, {
            execute: () => this.addRung(),
        });
    }
    registerMenus(menus) {
        // Add Compile to the Edit menu
        menus.registerMenuAction(common_menus_1.CommonMenus.EDIT, {
            commandId: exports.LD_EDITOR_COMMANDS.COMPILE.id,
            label: 'LD: Compile',
            order: 'z',
        });
        menus.registerMenuAction(common_menus_1.CommonMenus.EDIT, {
            commandId: exports.LD_EDITOR_COMMANDS.UNDO.id,
            label: 'LD: Undo',
            order: 'z1',
        });
        menus.registerMenuAction(common_menus_1.CommonMenus.EDIT, {
            commandId: exports.LD_EDITOR_COMMANDS.REDO.id,
            label: 'LD: Redo',
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
            this.messageService.warn('No active LD editor to save');
            return;
        }
        // Get URI from title
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
    // ── Add Rung ───────────────────────────────────────────────
    addRung() {
        const graph = this.modelState.graph;
        const next = this.operationHandler.addRung(graph);
        this.modelState.applyOperation(() => next);
    }
};
exports.LdEditorCommandContribution = LdEditorCommandContribution;
exports.LdEditorCommandContribution = LdEditorCommandContribution = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)(LdEditorOpenHandler)),
    __param(1, (0, inversify_1.inject)(ld_gmodel_state_1.LdGModelState)),
    __param(2, (0, inversify_1.inject)(ld_operation_handler_1.LdOperationHandler)),
    __param(3, (0, inversify_1.inject)(core_1.MessageService)),
    __param(4, (0, inversify_1.inject)(file_service_1.FileService)),
    __metadata("design:paramtypes", [LdEditorOpenHandler,
        ld_gmodel_state_1.LdGModelState,
        ld_operation_handler_1.LdOperationHandler,
        core_1.MessageService,
        file_service_1.FileService])
], LdEditorCommandContribution);
//# sourceMappingURL=ld-editor-contribution.js.map