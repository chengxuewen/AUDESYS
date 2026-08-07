/**
 * ST Compile Command Contribution — "Compile" (F7) for the active ST file.
 *
 * Takes the current Monaco editor's source, routes it to the backend
 * `compileSt` JSON-RPC service (which loads the napi-rs bridge), and maps
 * the result into Monaco in-editor diagnostics:
 *   - success: clear markers, status "Compile OK"
 *   - error:   parse "at line N, col M" from the compiler message and set a
 *              red marker at that position (spanning the line), plus a
 *              notification with the full message.
 *
 * Codebase references: hal-binding-gen CompileError renders like
 * "parse error: unexpected token ... at line 3, col 5" / "codegen error:
 * undefined variable 'x'". Codegen errors carry no line info → marker on
 * line 1.
 */
import {
    CommandContribution, Command, CommandRegistry,
} from '@theia/core/lib/common';
import { injectable, inject } from '@theia/core/shared/inversify';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
import { WebSocketConnectionProvider, FrontendApplication, FrontendApplicationContribution, KeybindingContribution, KeybindingRegistry } from '@theia/core/lib/browser';
import { MessageService } from '@theia/core/lib/common';
import * as monaco from '@theia/monaco-editor-core';
import { StCompileServer, StCompileServicePath } from '../common/st-compile-protocol';

export const ST_COMPILE_COMMAND: Command = {
    id: 'audesys-st.compile',
    label: 'Compile (ST→HalProgram)',
    category: 'ST',
};

interface StMarker { line: number; column: number; message: string; severity: monaco.MarkerSeverity; }

/** Extract a 1-based {line, column} from a compiler message like "... at line 3, col 5". */
function parsePosition(message: string): { line: number; column: number } | null {
    const m = /line\s+(\d+)(?:,\s*col\s+(\d+))?/i.exec(message);
    if (!m) return null;
    return { line: Number(m[1]), column: Number(m[2] ?? 1) };
}

@injectable()
export class StCompileCommandContribution implements CommandContribution, KeybindingContribution, FrontendApplicationContribution {
    @inject(EditorManager)
    private readonly editorManager!: EditorManager;

    @inject(WebSocketConnectionProvider)
    private readonly connectionProvider!: WebSocketConnectionProvider;

    @inject(MessageService)
    private readonly messageService!: MessageService;

    private compileServer: StCompileServer | null = null;

    onStart(_app: FrontendApplication): void {
        this.compileServer = this.connectionProvider.createProxy<StCompileServer>(StCompileServicePath);
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(ST_COMPILE_COMMAND, {
            execute: () => this.compileActiveEditor(),
            isEnabled: () => this.isActiveStEditor(),
        });
    }

    registerKeybindings(bindings: KeybindingRegistry): void {
        bindings.registerKeybinding({ command: ST_COMPILE_COMMAND.id, keybinding: 'f7' });
    }

    private isActiveStEditor(): boolean {
        const w = this.editorManager.currentEditor;
        return !!w && w.editor.document.languageId === 'st';
    }

    private async compileActiveEditor(): Promise<void> {
        const widget = this.editorManager.currentEditor;
        if (!widget || !this.compileServer) return;
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
            const markers: StMarker[] = [];
            const pos = parsePosition(msg);
            const line = pos ? pos.line : 1;
            const column = pos ? pos.column : 1;
            markers.push({ line, column, message: msg, severity: monaco.MarkerSeverity.Error });
            this.setMarkers(widget, markers);
            await this.messageService.error(msg);
        }
    }

    /** Set Monaco markers on the active editor's underlying ITextModel. */
    private setMarkers(widget: EditorWidget, markers: StMarker[]): void {
        const editor = widget.editor as unknown as { getControl?: () => monaco.editor.IStandaloneCodeEditor };
        const control = editor.getControl?.();
        const model = control?.getModel();
        if (!model) return;
        monaco.editor.setModelMarkers(model, 'audesys-st', markers.map((mk) => ({
            startLineNumber: mk.line,
            startColumn: mk.column,
            endLineNumber: mk.line,
            endColumn: 2000,
            message: mk.message,
            severity: mk.severity,
        })));
    }
}