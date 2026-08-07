import { injectable, inject } from '@theia/core/shared/inversify';
import {
    Command, CommandContribution, CommandRegistry,
    MenuContribution, MenuModelRegistry,
} from '@theia/core/lib/common';
import { CommonMenus } from '@theia/core/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { MessageService } from '@theia/core/lib/common/message-service';
import { BinaryBuffer } from '@theia/core/lib/common/buffer';
import { IEC_LANG_DIR, nextFileName } from './iec-conventions';

export namespace IecNewFileCommands {
    export const CATEGORY = 'IEC 61131-3';

    export const NEW_ST: Command = {
        id: 'audesys.new.st',
        label: 'New Structured Text (ST) File',
        category: CATEGORY,
    };
    export const NEW_IL: Command = {
        id: 'audesys.new.il',
        label: 'New Instruction List (IL) File',
        category: CATEGORY,
    };
    export const NEW_LD: Command = {
        id: 'audesys.new.ld',
        label: 'New Ladder Diagram (LD) File',
        category: CATEGORY,
    };
    export const NEW_FBD: Command = {
        id: 'audesys.new.fbd',
        label: 'New Function Block Diagram (FBD) File',
        category: CATEGORY,
    };
    export const NEW_SFC: Command = {
        id: 'audesys.new.sfc',
        label: 'New Sequential Function Chart (SFC) File',
        category: CATEGORY,
    };
    export const NEW_GVL: Command = {
        id: 'audesys.new.gvl',
        label: 'New Global Variable List (GVL) File',
        category: CATEGORY,
    };
    export const NEW_HMI: Command = {
        id: 'audesys.new.hmi',
        label: 'New HMI Layout File',
        category: CATEGORY,
    };
    export const NEW_GCODE: Command = {
        id: 'audesys.new.gcode',
        label: 'New G-code CNC File',
        category: CATEGORY,
    };
}

export interface IecFileTemplate {
    command: Command;
    ext: string;
    template: string;
}

const IEC_TEMPLATES: IecFileTemplate[] = [
    { command: IecNewFileCommands.NEW_ST, ext: '.st', template: '(* Structured Text Program *)\n\nPROGRAM Main\nVAR\n    (* variables *)\nEND_VAR\n\n(* code *)\n\nEND_PROGRAM\n' },
    { command: IecNewFileCommands.NEW_IL, ext: '.il', template: '(* Instruction List Program *)\n\nLD TRUE\nST result\n' },
    { command: IecNewFileCommands.NEW_LD, ext: '.ld', template: '{"id":"untitled","nodes":[],"edges":[],"rungs":[]}' },
    { command: IecNewFileCommands.NEW_FBD, ext: '.fbd', template: '{"id":"untitled","nodes":[],"edges":[]}' },
    { command: IecNewFileCommands.NEW_SFC, ext: '.sfc', template: '(* Sequential Function Chart — placeholder *)\n' },
    { command: IecNewFileCommands.NEW_GVL, ext: '.gvl', template: '(* Global Variable List *)\n\nVAR_GLOBAL\n    (* global variables *)\nEND_VAR\n' },
    { command: IecNewFileCommands.NEW_HMI, ext: '.hmi', template: '# HMI Layout\nwidgets: []\n' },
    { command: IecNewFileCommands.NEW_GCODE, ext: '.gcode', template: '; G-code CNC Program\nG21 ; mm units\nG90 ; absolute positioning\nG0 X0 Y0 Z0\nM30\n' },
];

/**
 * IEC New File Contribution.
 * Adds New File wizard entries for all IEC 61131-3 languages, HMI, and CNC
 * in the File > New menu of Theia, writing each into its directory-convention
 * subdirectory (Programs/GVL/Hmi/Cnc).
 */
@injectable()
export class IecNewFileContribution implements CommandContribution, MenuContribution {
    @inject(FileService) protected readonly fileService!: FileService;
    @inject(WorkspaceService) protected readonly workspaceService!: WorkspaceService;
    @inject(MessageService) protected readonly messageService!: MessageService;

    registerCommands(registry: CommandRegistry): void {
        for (const entry of IEC_TEMPLATES) {
            registry.registerCommand(entry.command, {
                execute: async () => {
                    const workspaceRoot = this.workspaceService.tryGetRoots()[0];
                    if (!workspaceRoot) {
                        this.messageService.warn('No workspace folder open. Open a project first.');
                        return;
                    }
                    try {
                        const dirName = IEC_LANG_DIR[entry.ext];
                        const dirUri = dirName
                            ? workspaceRoot.resource.resolve(dirName)
                            : workspaceRoot.resource;
                        if (!(await this.fileService.exists(dirUri))) {
                            await this.fileService.createFolder(dirUri);
                        }
                        // Auto-increment within the subdirectory: untitled.ld → untitled-1.ld → ...
                        let target = dirUri.resolve(`untitled${entry.ext}`);
                        let counter = 0;
                        while (await this.fileService.exists(target) && counter < 100) {
                            counter++;
                            target = dirUri.resolve(`untitled-${counter}${entry.ext}`);
                        }
                        await this.fileService.writeFile(
                            target,
                            BinaryBuffer.fromString(entry.template)
                        );
                        this.messageService.info(`Created: ${target.displayName}`);
                    } catch (e) {
                        this.messageService.error(`Failed to create file: ${String(e)}`);
                    }
                },
            });
        }
    }

    registerMenus(menus: MenuModelRegistry): void {
        // IEC 61131-3 submenu under File > New
        menus.registerSubmenu(CommonMenus.FILE_NEW, 'IEC 61131-3');
        const menu = [...CommonMenus.FILE_NEW, 'IEC 61131-3'];
        const actions: Array<{ command: Command; label: string; order: string }> = [
            { command: IecNewFileCommands.NEW_ST, label: 'Structured Text (.st)', order: 'a' },
            { command: IecNewFileCommands.NEW_IL, label: 'Instruction List (.il)', order: 'b' },
            { command: IecNewFileCommands.NEW_LD, label: 'Ladder Diagram (.ld)', order: 'c' },
            { command: IecNewFileCommands.NEW_FBD, label: 'Function Block Diagram (.fbd)', order: 'd' },
            { command: IecNewFileCommands.NEW_SFC, label: 'Sequential Function Chart (.sfc)', order: 'e' },
            { command: IecNewFileCommands.NEW_GVL, label: 'Global Variable List (.gvl)', order: 'f' },
            { command: IecNewFileCommands.NEW_HMI, label: 'HMI Layout (.hmi)', order: 'g' },
            { command: IecNewFileCommands.NEW_GCODE, label: 'G-code CNC (.gcode)', order: 'h' },
        ];
        for (const action of actions) {
            menus.registerMenuAction(menu, {
                commandId: action.command.id,
                label: action.label,
                order: action.order,
            });
        }
    }
}