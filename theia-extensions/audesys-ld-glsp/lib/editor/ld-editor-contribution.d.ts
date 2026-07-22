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
import { CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry, MessageService } from '@theia/core';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { OpenHandler } from '@theia/core/lib/browser/opener-service';
import { URI } from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { LdToolState } from '../tool-palette/ld-tool-state';
import { LdGModelState } from '../server/ld-gmodel-state';
import { LdOperationHandler } from '../server/ld-operation-handler';
import { LdEditorWidget } from './ld-editor-widget';
export declare const LD_EDITOR_COMMANDS: {
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
    ADD_RUNG: {
        id: string;
        label: string;
    };
};
export declare class LdEditorOpenHandler implements OpenHandler {
    private readonly shell;
    private readonly toolState;
    private readonly modelState;
    private readonly handler;
    private readonly fileService;
    readonly id = "audesys-ld-editor-handler";
    private editors;
    constructor(shell: ApplicationShell, toolState: LdToolState, modelState: LdGModelState, handler: LdOperationHandler, fileService: FileService);
    canHandle(uri: URI): number;
    open(uri: URI): Promise<LdEditorWidget | undefined>;
    /** Get the currently active LD editor widget. */
    getActiveEditor(): LdEditorWidget | undefined;
}
export declare class LdEditorCommandContribution implements CommandContribution, MenuContribution {
    private readonly openHandler;
    private readonly modelState;
    private readonly operationHandler;
    private readonly messageService;
    private readonly fileService;
    constructor(openHandler: LdEditorOpenHandler, modelState: LdGModelState, operationHandler: LdOperationHandler, messageService: MessageService, fileService: FileService);
    registerCommands(registry: CommandRegistry): void;
    registerMenus(menus: MenuModelRegistry): void;
    private compile;
    private save;
    private undo;
    private redo;
    private addRung;
}
//# sourceMappingURL=ld-editor-contribution.d.ts.map