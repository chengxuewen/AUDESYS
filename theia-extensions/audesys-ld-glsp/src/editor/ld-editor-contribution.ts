/**
 * LD Editor Contribution — Theia OpenHandler + CommandContribution for .ld files.
 *
 * Registers:
 * - OpenHandler: opens .ld files in the LD editor widget
 * - CommandContribution: Compile, Deploy, Save, Undo, Redo toolbar commands
 * - Wires tool palette selection → editor actions
 *
 * Ponytail: one class, multiple contribution interfaces. No separate handler classes.
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
import { OpenerService, open, OpenHandler } from '@theia/core/lib/browser/opener-service';
import { URI } from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';

import { LdToolState } from '../tool-palette/ld-tool-state';
import { LdGModelState } from '../server/ld-gmodel-state';
import { LdOperationHandler, CompileResult } from '../server/ld-operation-handler';
import { LdEditorWidget, LdEditorSelection } from './ld-editor-widget';
import { fromJSON, toJSON } from '../gmodel/serialization';
import { LdGraph } from '../gmodel/model';

// ============================================================================
// Commands
// ============================================================================

export const LD_EDITOR_COMMANDS = {
    COMPILE: {
        id: 'audesys.ld.compile',
        label: 'LD: Compile',
        category: 'Ladder Diagram',
    },
    DEPLOY: {
        id: 'audesys.ld.deploy',
        label: 'LD: Deploy',
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

@injectable()
export class LdEditorOpenHandler implements OpenHandler {
    readonly id = 'audesys-ld-editor-handler';

    // Track which widget is currently open for which URI
    private editors = new Map<string, LdEditorWidget>();

    constructor(
        @inject(ApplicationShell) private readonly shell: ApplicationShell,
        @inject(LdToolState) private readonly toolState: LdToolState,
        @inject(LdGModelState) private readonly modelState: LdGModelState,
        @inject(LdOperationHandler) private readonly handler: LdOperationHandler,
        @inject(FileService) private readonly fileService: FileService,
    ) {}

    canHandle(uri: URI): number {
        if (uri.path.ext === '.ld') {
            return 1000; // High priority for .ld files
        }
        return 0;
    }

    async open(uri: URI): Promise<LdEditorWidget | undefined> {
        // Reuse existing editor if already open for this URI
        const existing = this.editors.get(uri.toString());
        if (existing) {
            await this.shell.activateWidget(existing.id);
            return existing;
        }

        // Read file content
        let graph: LdGraph;
        try {
            const content = await this.fileService.read(uri);
            graph = fromJSON(content.value);
        } catch {
            // New file — create empty graph
            const { createLdGraph } = require('../gmodel/model');
            graph = createLdGraph();
        }

        // Create fresh model state with loaded graph
        this.modelState.applyOperation(() => graph);
        this.modelState.markClean();

        // Create editor widget
        const widget = new LdEditorWidget(this.toolState, this.modelState, this.handler);
        widget.title.label = uri.displayName;
        widget.title.caption = uri.path.toString();
        widget.title.closable = true;

        // Wire selection changes
        widget.setSelectionCallback((sel: LdEditorSelection | null) => {
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
    getActiveEditor(): LdEditorWidget | undefined {
        for (const w of this.editors.values()) {
            if (w.isVisible) return w;
        }
        return undefined;
    }
}

// ============================================================================
// LdEditorCommandContribution
// ============================================================================

@injectable()
export class LdEditorCommandContribution implements CommandContribution, MenuContribution {

    constructor(
        @inject(LdEditorOpenHandler) private readonly openHandler: LdEditorOpenHandler,
        @inject(LdGModelState) private readonly modelState: LdGModelState,
        @inject(LdOperationHandler) private readonly operationHandler: LdOperationHandler,
        @inject(MessageService) private readonly messageService: MessageService,
        @inject(FileService) private readonly fileService: FileService,
    ) {}

    registerCommands(registry: CommandRegistry): void {
        // Compile
        registry.registerCommand(LD_EDITOR_COMMANDS.COMPILE, {
            execute: () => this.compile(),
        });

        // Deploy
        registry.registerCommand(LD_EDITOR_COMMANDS.DEPLOY, {
            execute: () => this.deploy(),
        });

        // Save
        registry.registerCommand(LD_EDITOR_COMMANDS.SAVE, {
            execute: () => this.save(),
        });

        // Undo
        registry.registerCommand(LD_EDITOR_COMMANDS.UNDO, {
            execute: () => this.undo(),
            isEnabled: () => this.modelState.undoDepth > 0,
        });

        // Redo
        registry.registerCommand(LD_EDITOR_COMMANDS.REDO, {
            execute: () => this.redo(),
            isEnabled: () => this.modelState.redoDepth > 0,
        });

        // Add Rung
        registry.registerCommand(LD_EDITOR_COMMANDS.ADD_RUNG, {
            execute: () => this.addRung(),
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        // Add Compile to the Edit menu
        menus.registerMenuAction(CommonMenus.EDIT, {
            commandId: LD_EDITOR_COMMANDS.COMPILE.id,
            label: 'LD: Compile',
            order: 'z',
        });
        menus.registerMenuAction(CommonMenus.EDIT, {
            commandId: LD_EDITOR_COMMANDS.DEPLOY.id,
            label: 'LD: Deploy',
            order: 'z0',
        });
        menus.registerMenuAction(CommonMenus.EDIT, {
            commandId: LD_EDITOR_COMMANDS.UNDO.id,
            label: 'LD: Undo',
            order: 'z1',
        });
        menus.registerMenuAction(CommonMenus.EDIT, {
            commandId: LD_EDITOR_COMMANDS.REDO.id,
            label: 'LD: Redo',
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

    // ── Deploy ─────────────────────────────────────────────────

    private deploy(): void {
        const graph = this.modelState.graph;
        const result: CompileResult = this.operationHandler.compile(graph);

        if (!result.success) {
            const diag = result.diagnostics
                .map((d) => `[${d.severity}] ${d.message} (${d.code})`)
                .join('\n');
            this.messageService.error(
                `Deploy aborted — compilation failed with ${result.diagnostics.length} error(s):\n\n${diag}`
            );
            return;
        }

        // ponytail: env var or well-known default, same as iec-context-menu.ts
        const socketPath = process.env.AUDESYS_SOCKET ?? '/tmp/audesys-controller.sock';
        const secret = process.env.AUDESYS_HMAC_SECRET ?? 'audesys-dev-secret';

        try {
            const bridge = require('@audesys/theia-bridge');
            bridge.deployProgram(socketPath, secret, result.programJson);
            this.modelState.markClean();
            this.messageService.info(
                `Deployed LD program to Controller at ${socketPath}\n` +
                `Program size: ${result.programJson.length} bytes`
            );
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('ECONNREFUSED') || msg.includes('ENOENT')) {
                this.messageService.error(
                    `Deploy failed: No Controller running at ${socketPath}. Start the Controller first.`
                );
            } else {
                this.messageService.error(`Deploy failed: ${msg}`);
            }
        }
    }

    // ── Save ───────────────────────────────────────────────────

    private async save(): Promise<void> {
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

    // ── Add Rung ───────────────────────────────────────────────

    private addRung(): void {
        const graph = this.modelState.graph;
        const next = this.operationHandler.addRung(graph);
        this.modelState.applyOperation(() => next);
    }
}
