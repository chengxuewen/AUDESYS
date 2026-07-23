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
import { CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry, MessageService } from '@theia/core';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { OpenHandler } from '@theia/core/lib/browser/opener-service';
import { URI } from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { FbdToolState } from '../tool-palette/fbd-tool-state';
import { FbdGModelState } from '../server/fbd-gmodel-state';
import { FbdOperationHandler } from '../server/fbd-operation-handler';
import { FbdEditorWidget } from './fbd-editor-widget';
export declare const FBD_EDITOR_COMMANDS: {
    COMPILE: {
        id: string;
        label: string;
        category: string;
    };
    SAVE: {
        id: string;
        label: string;
        category: string;
    };
    UNDO: {
        id: string;
        label: string;
    };
    REDO: {
        id: string;
        label: string;
    };
};
export declare class FbdEditorOpenHandler implements OpenHandler {
    private readonly shell;
    private readonly toolState;
    private readonly modelState;
    private readonly handler;
    private readonly fileService;
    readonly id = "audesys-fbd-editor-handler";
    private editors;
    constructor(shell: ApplicationShell, toolState: FbdToolState, modelState: FbdGModelState, handler: FbdOperationHandler, fileService: FileService);
    canHandle(uri: URI): number;
    open(uri: URI): Promise<FbdEditorWidget | undefined>;
    /** Get the currently active FBD editor widget. */
    getActiveEditor(): FbdEditorWidget | undefined;
}
export declare class FbdEditorCommandContribution implements CommandContribution, MenuContribution {
    private readonly openHandler;
    private readonly modelState;
    private readonly operationHandler;
    private readonly messageService;
    private readonly fileService;
    constructor(openHandler: FbdEditorOpenHandler, modelState: FbdGModelState, operationHandler: FbdOperationHandler, messageService: MessageService, fileService: FileService);
    registerCommands(registry: CommandRegistry): void;
    registerMenus(menus: MenuModelRegistry): void;
    private compile;
    private save;
    private undo;
    private redo;
}
//# sourceMappingURL=fbd-editor-contribution.d.ts.map