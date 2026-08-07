import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { FileDialogService } from '@theia/filesystem/lib/browser/file-dialog/file-dialog-service';
export declare namespace OpenFolderMenuCommands {
    const OPEN_FOLDER: Command;
}
/**
 * Registers "Open Folder..." in the File menu for platforms where Theia
 * hides it (macOS browser mode, and browser mode in general).
 */
export declare class OpenFolderMenuContribution implements CommandContribution, MenuContribution {
    protected readonly workspaceService: WorkspaceService;
    protected readonly fileDialogService: FileDialogService;
    registerCommands(registry: CommandRegistry): void;
    registerMenus(menus: MenuModelRegistry): void;
}
//# sourceMappingURL=open-folder-menu.d.ts.map