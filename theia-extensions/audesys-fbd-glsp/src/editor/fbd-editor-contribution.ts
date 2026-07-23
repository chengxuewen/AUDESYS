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

import { injectable, inject } from '@theia/core/shared/inversify';
import {
    CommandContribution,
    CommandRegistry,
    MenuContribution,
    MenuModelRegistry,
    MessageService,
} from '@theia/core';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { OpenHandler } from '@theia/core/lib/browser/opener-service';
import { URI } from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';

import { FbdToolState } from '../tool-palette/fbd-tool-state';
import { FbdGModelState } from '../server/fbd-gmodel-state';
import { FbdOperationHandler, CompileResult } from '../server/fbd-operation-handler';
import { FbdEditorWidget, FbdEditorSelection } from './fbd-editor-widget';
import { fromJSON, toJSON } from '../gmodel/serialization';
import { FbdGraph, createFbdGraph } from '../gmodel/model';

// ============================================================================
// Commands
// ============================================================================

export const FBD_EDITOR_COMMANDS = {
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

@injectable()
export class FbdEditorOpenHandler implements OpenHandler {
    readonly id = 'audesys-fbd-editor-handler';

    private editors = new Map<string, FbdEditorWidget>();

    constructor(
        @inject(ApplicationShell) private readonly shell: ApplicationShell,
        @inject(FbdToolState) private readonly toolState: FbdToolState,
        @inject(FbdGModelState) private readonly modelState: FbdGModelState,
        @inject(FbdOperationHandler) private readonly handler: FbdOperationHandler,
        @inject(FileService) private readonly fileService: FileService,
    ) {}

    canHandle(uri: URI): number {
        if (uri.path.ext === '.fbd') {
            return 1000;
        }
        return 0;
    }

    async open(uri: URI): Promise<FbdEditorWidget | undefined> {
        // Reuse existing editor
        const existing = this.editors.get(uri.toString());
        if (existing) {
            await this.shell.activateWidget(existing.id);
            return existing;
        }

        // Read file content
        let graph: FbdGraph;
        try {
            const content = await this.fileService.read(uri);
            graph = fromJSON(content.value);
        } catch {
            // New file — create empty graph
            graph = createFbdGraph();
        }

        // Create fresh model state
        this.modelState.applyOperation(() => graph);
        this.modelState.markClean();

        // Create editor widget
        const widget = new FbdEditorWidget(this.toolState, this.modelState, this.handler);
        widget.title.label = uri.displayName;
        widget.title.caption = uri.path.toString();
        widget.title.closable = true;

        widget.setSelectionCallback((sel: FbdEditorSelection | null) => {
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
    getActiveEditor(): FbdEditorWidget | undefined {
        for (const w of this.editors.values()) {
            if (w.isVisible) return w;
        }
        return undefined;
    }
}

// ============================================================================
// FbdEditorCommandContribution
// ============================================================================

@injectable()
export class FbdEditorCommandContribution implements CommandContribution, MenuContribution {

    constructor(
        @inject(FbdEditorOpenHandler) private readonly openHandler: FbdEditorOpenHandler,
        @inject(FbdGModelState) private readonly modelState: FbdGModelState,
        @inject(FbdOperationHandler) private readonly operationHandler: FbdOperationHandler,
        @inject(MessageService) private readonly messageService: MessageService,
        @inject(FileService) private readonly fileService: FileService,
    ) {}

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(FBD_EDITOR_COMMANDS.COMPILE, {
            execute: () => this.compile(),
        });

        registry.registerCommand(FBD_EDITOR_COMMANDS.SAVE, {
            execute: () => this.save(),
        });

        registry.registerCommand(FBD_EDITOR_COMMANDS.UNDO, {
            execute: () => this.undo(),
            isEnabled: () => this.modelState.canUndo,
        });

        registry.registerCommand(FBD_EDITOR_COMMANDS.REDO, {
            execute: () => this.redo(),
            isEnabled: () => this.modelState.canRedo,
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.EDIT, {
            commandId: FBD_EDITOR_COMMANDS.COMPILE.id,
            label: 'FBD: Compile',
            order: 'z',
        });
        menus.registerMenuAction(CommonMenus.EDIT, {
            commandId: FBD_EDITOR_COMMANDS.UNDO.id,
            label: 'FBD: Undo',
            order: 'z1',
        });
        menus.registerMenuAction(CommonMenus.EDIT, {
            commandId: FBD_EDITOR_COMMANDS.REDO.id,
            label: 'FBD: Redo',
            order: 'z2',
        });
    }

    // ── Compile ────────────────────────────────────────────────
    private compile(): void {
        const graph = this.modelState.graph;
        const result: CompileResult = this.operationHandler.compile(graph);

        if (result.success) {
            this.modelState.markClean();
            this.messageService.info(
                'Compilation successful!\n\n' +
                `Output size: ${result.programJson.length} bytes`
            );
        } else {
            const diag = result.diagnostics
                .map((d) => `[${d.severity}] ${d.message} (${d.code})`)
                .join('\n');
            this.messageService.error(
                `Compilation failed with ${result.diagnostics.length} error(s):\n\n${diag}`
            );
        }
    }

    // ── Save ───────────────────────────────────────────────────
    private async save(): Promise<void> {
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
            const json = toJSON(graph);
            const uri = new URI(uriPath);
            await this.fileService.write(uri, json);
            this.modelState.markClean();
            this.messageService.info(`Saved: ${uri.displayName}`);
        } catch (err) {
            this.messageService.error(
                `Failed to save: ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }

    // ── Undo / Redo ────────────────────────────────────────────
    private undo(): void {
        this.modelState.undo();
    }

    private redo(): void {
        this.modelState.redo();
    }
}
