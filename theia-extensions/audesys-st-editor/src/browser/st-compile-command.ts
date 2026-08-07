/**
 * ST Compile Command Contributions — single-file "Compile" (F7) and
 * project-level "Compile Project" (F6).
 *
 * Single-file: takes the active Monaco editor's source, routes it to the
 * backend `compileSt` JSON-RPC service, maps the result into Monaco
 * in-editor diagnostics for that file.
 *
 * Project: collects every .st/.il POU file under the workspace, routes them
 * to the backend `compileProject` (per-file compile with per-file errors),
 * then maps each failing file's error into Monaco markers on that file
 * (opening it so the marker and Problems-panel entry are visible).
 */
import {
    CommandContribution, Command, CommandRegistry,
} from '@theia/core/lib/common';
import { injectable, inject } from '@theia/core/shared/inversify';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
import { WebSocketConnectionProvider, FrontendApplication, FrontendApplicationContribution, KeybindingContribution, KeybindingRegistry } from '@theia/core/lib/browser';
import { MessageService } from '@theia/core/lib/common';
import * as monaco from '@theia/monaco-editor-core';
import URI from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { CompileInput, ProjectCompileResult, StCompileServer, StCompileServicePath } from '../common/st-compile-protocol';
import { MarkerSeverityName, mapProjectResultToMarkers, parsePosition, StMarker } from './st-project-compile';

export const ST_COMPILE_COMMAND: Command = {
    id: 'audesys-st.compile',
    label: 'Compile (ST→HalProgram)',
    category: 'ST',
};

export const ST_COMPILE_PROJECT_COMMAND: Command = {
    id: 'audesys-st.compile-project',
    label: 'Compile Project (All POU files)',
    category: 'ST',
};

export const ST_DEPLOY_COMMAND: Command = {
    id: 'audesys-st.deploy',
    label: 'Deploy Project to Runtime',
    category: 'ST',
};

const SEVERITY: Record<MarkerSeverityName, monaco.MarkerSeverity> = {
    Error: monaco.MarkerSeverity.Error,
    Warning: monaco.MarkerSeverity.Warning,
    Info: monaco.MarkerSeverity.Info,
    Hint: monaco.MarkerSeverity.Hint,
};

@injectable()
export class StCompileCommandContribution implements CommandContribution, KeybindingContribution, FrontendApplicationContribution {
    @inject(EditorManager)
    private readonly editorManager!: EditorManager;

    @inject(WebSocketConnectionProvider)
    private readonly connectionProvider!: WebSocketConnectionProvider;

    @inject(MessageService)
    private readonly messageService!: MessageService;

    @inject(FileService)
    private readonly fileService!: FileService;

    @inject(WorkspaceService)
    private readonly workspaceService!: WorkspaceService;

    private compileServer: StCompileServer | null = null;

    onStart(_app: FrontendApplication): void {
        this.compileServer = this.connectionProvider.createProxy<StCompileServer>(StCompileServicePath);
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(ST_COMPILE_COMMAND, {
            execute: () => this.compileActiveEditor(),
            isEnabled: () => this.isActiveStEditor(),
        });
        commands.registerCommand(ST_COMPILE_PROJECT_COMMAND, {
            execute: () => this.compileProject(),
        });
        commands.registerCommand(ST_DEPLOY_COMMAND, {
            execute: () => this.deployProject(),
        });
    }

    registerKeybindings(bindings: KeybindingRegistry): void {
        bindings.registerKeybinding({ command: ST_COMPILE_COMMAND.id, keybinding: 'f7' });
        bindings.registerKeybinding({ command: ST_COMPILE_PROJECT_COMMAND.id, keybinding: 'f6' });
        bindings.registerKeybinding({ command: ST_DEPLOY_COMMAND.id, keybinding: 'f9' });
    }

    private isActiveStEditor(): boolean {
        const w = this.editorManager.currentEditor;
        return !!w && w.editor.document.languageId === 'st';
    }

    private async compileActiveEditor(): Promise<void> {
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
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            const pos = parsePosition(msg);
            const markers: StMarker[] = [{
                line: pos ? pos.line : 1,
                column: pos ? pos.column : 1,
                message: msg,
                severity: 'Error',
            }];
            this.setMarkers(widget, markers);
            await this.messageService.error(msg);
        }
    }

    private async compileProject(): Promise<void> {
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
        const result: ProjectCompileResult = await this.compileServer.compileProject(programs);
        const markersByPath = mapProjectResultToMarkers(result);
        const errors = result.results.filter((r) => !r.ok);
        for (const r of errors) {
            await this.openAndMark(r.path, markersByPath.get(r.path) ?? []);
        }
        this.clearOkMarkers(result.results);
        if (errors.length === 0) {
            await this.messageService.info(`Compile OK: ${programs.length} file(s)`);
        } else {
            await this.messageService.error(`Compile failed: ${errors.length}/${programs.length} file(s) with errors`);
        }
    }

    /** Recursively collect every .st/.il file under the workspace root. */
    private async collectPouSources(root: URI): Promise<CompileInput[]> {
        const out: CompileInput[] = [];
        const stack: URI[] = [root];
        while (stack.length > 0) {
            const uri = stack.pop() as URI;
            const stat = await this.fileService.resolve(uri);
            if (stat.isDirectory) {
                for (const child of stat.children ?? []) {
                    stack.push(child.resource);
                }
            } else if (stat.isFile) {
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
    private async openAndMark(uriString: string, markers: StMarker[]): Promise<void> {
        try {
            const widget = await this.editorManager.open(new URI(uriString));
            this.setMarkers(widget, markers);
        } catch (e) {
            await this.messageService.error(`Failed to open ${uriString}: ${String(e)}`);
        }
    }

    /** Clear compile markers on any open model that compiled successfully. */
    private clearOkMarkers(results: readonly { path: string; ok: boolean }[]): void {
        const okByPath = new Set(results.filter((r) => r.ok).map((r) => r.path));
        for (const model of monaco.editor.getModels()) {
            if (okByPath.has(model.uri.toString())) {
                monaco.editor.setModelMarkers(model, 'audesys-st', []);
            }
        }
    }

    /** Set Monaco markers on a widget's underlying ITextModel. */
    private setMarkers(widget: EditorWidget, markers: StMarker[]): void {
        const editor = widget.editor as unknown as { getControl?: () => monaco.editor.IStandaloneCodeEditor };
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

    private async deployProject(): Promise<void> {
        const root = this.workspaceService.tryGetRoots()[0]?.resource;
        if (!this.compileServer) {
            return;
        }
        if (!root) {
            await this.messageService.warn('Open a workspace first to deploy the project.');
            return;
        }
        const programs = await this.collectPouSources(root);
        if (programs.length === 0) {
            await this.messageService.info('No .st/.il files found in the workspace.');
            return;
        }
        try {
            const result = await this.compileServer.deployProject(programs);
            await this.messageService.info(`Deploy OK: ${result}`);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await this.messageService.error(`Deploy failed: ${msg}`);
        }
    }
}
