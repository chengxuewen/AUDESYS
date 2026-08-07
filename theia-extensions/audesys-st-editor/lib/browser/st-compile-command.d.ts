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
import { CommandContribution, Command, CommandRegistry } from '@theia/core/lib/common';
import { FrontendApplication, FrontendApplicationContribution, KeybindingContribution, KeybindingRegistry } from '@theia/core/lib/browser';
export declare const ST_COMPILE_COMMAND: Command;
export declare const ST_COMPILE_PROJECT_COMMAND: Command;
export declare class StCompileCommandContribution implements CommandContribution, KeybindingContribution, FrontendApplicationContribution {
    private readonly editorManager;
    private readonly connectionProvider;
    private readonly messageService;
    private readonly fileService;
    private readonly workspaceService;
    private compileServer;
    onStart(_app: FrontendApplication): void;
    registerCommands(commands: CommandRegistry): void;
    registerKeybindings(bindings: KeybindingRegistry): void;
    private isActiveStEditor;
    private compileActiveEditor;
    private compileProject;
    /** Recursively collect every .st/.il file under the workspace root. */
    private collectPouSources;
    /** Open a failing file and set its markers (so the Problems panel shows them). */
    private openAndMark;
    /** Clear compile markers on any open model that compiled successfully. */
    private clearOkMarkers;
    /** Set Monaco markers on a widget's underlying ITextModel. */
    private setMarkers;
}
//# sourceMappingURL=st-compile-command.d.ts.map