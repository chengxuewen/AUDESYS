import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { MessageService } from '@theia/core/lib/common/message-service';
export declare namespace IecNewFileCommands {
    const CATEGORY = "IEC 61131-3";
    const NEW_ST: Command;
    const NEW_IL: Command;
    const NEW_LD: Command;
    const NEW_FBD: Command;
    const NEW_SFC: Command;
    const NEW_HMI: Command;
    const NEW_GCODE: Command;
}
/**
 * IEC New File Contribution.
 * Adds New File wizard entries for all IEC 61131-3 languages, HMI, and CNC
 * in the File > New menu of Theia.
 */
export declare class IecNewFileContribution implements CommandContribution, MenuContribution {
    protected readonly fileService: FileService;
    protected readonly workspaceService: WorkspaceService;
    protected readonly messageService: MessageService;
    registerCommands(registry: CommandRegistry): void;
    registerMenus(menus: MenuModelRegistry): void;
}
//# sourceMappingURL=iec-new-file-contribution.d.ts.map