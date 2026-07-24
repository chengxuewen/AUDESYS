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

const IEC_TEMPLATES: Array<{ command: Command; ext: string; template: string }> = [
    { command: IecNewFileCommands.NEW_ST, ext: '.st', template: '(* Structured Text Program *)\n\nPROGRAM Main\nVAR\n    (* variables *)\nEND_VAR\n\n(* code *)\n\nEND_PROGRAM\n' },
    { command: IecNewFileCommands.NEW_IL, ext: '.il', template: '(* Instruction List Program *)\n\nLD TRUE\nST result\n' },
    { command: IecNewFileCommands.NEW_LD, ext: '.ld', template: '{"id":"untitled","nodes":[],"edges":[],"rungs":[]}' },
    { command: IecNewFileCommands.NEW_FBD, ext: '.fbd', template: '{"id":"untitled","nodes":[],"edges":[]}' },
    { command: IecNewFileCommands.NEW_SFC, ext: '.sfc', template: '(* Sequential Function Chart — placeholder *)\n' },
    { command: IecNewFileCommands.NEW_HMI, ext: '.hmi', template: '# HMI Layout\nwidgets: []\n' },
    { command: IecNewFileCommands.NEW_GCODE, ext: '.gcode', template: '; G-code CNC Program\nG21 ; mm units\nG90 ; absolute positioning\nG0 X0 Y0 Z0\nM30\n' },
];

/**
 * IEC New File Contribution.
 * Adds New File wizard entries for all IEC 61131-3 languages, HMI, and CNC
 * in the File > New menu of Theia.
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
                        const fileUri = workspaceRoot.resource.resolve(`untitled${entry.ext}`);
                        const exists = await this.fileService.exists(fileUri);
                        if (!exists) {
                            await this.fileService.createFile(
                                fileUri,
                                BinaryBuffer.fromString(entry.template)
                            );
                            this.messageService.info(`Created: ${fileUri.displayName}`);
                        } else {
                            this.messageService.warn(`File already exists: ${fileUri.displayName}`);
                        }
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
        menus.registerMenuAction([...CommonMenus.FILE_NEW, 'IEC 61131-3'], {
            commandId: IecNewFileCommands.NEW_ST.id,
            label: 'Structured Text (.st)',
            order: 'a',
        });
        menus.registerMenuAction([...CommonMenus.FILE_NEW, 'IEC 61131-3'], {
            commandId: IecNewFileCommands.NEW_IL.id,
            label: 'Instruction List (.il)',
            order: 'b',
        });
        menus.registerMenuAction([...CommonMenus.FILE_NEW, 'IEC 61131-3'], {
            commandId: IecNewFileCommands.NEW_LD.id,
            label: 'Ladder Diagram (.ld)',
            order: 'c',
        });
        menus.registerMenuAction([...CommonMenus.FILE_NEW, 'IEC 61131-3'], {
            commandId: IecNewFileCommands.NEW_FBD.id,
            label: 'Function Block Diagram (.fbd)',
            order: 'd',
        });
        menus.registerMenuAction([...CommonMenus.FILE_NEW, 'IEC 61131-3'], {
            commandId: IecNewFileCommands.NEW_SFC.id,
            label: 'Sequential Function Chart (.sfc)',
            order: 'e',
        });
        menus.registerMenuAction([...CommonMenus.FILE_NEW, 'IEC 61131-3'], {
            commandId: IecNewFileCommands.NEW_HMI.id,
            label: 'HMI Layout (.hmi)',
            order: 'f',
        });
        menus.registerMenuAction([...CommonMenus.FILE_NEW, 'IEC 61131-3'], {
            commandId: IecNewFileCommands.NEW_GCODE.id,
            label: 'G-code CNC (.gcode)',
            order: 'g',
        });
    }
}
