/**
 * Open Folder Menu Fix — AUDESYS
 *
 * Theia's File menu only shows "Open Folder" on Linux/Windows Electron
 * (workspace-frontend-contribution.js: `if (!isOSX && this.isElectron())`).
 * On macOS browser mode there is NO "Open Folder" entry — only
 * "Open Workspace from File..." which expects a .theia-workspace file,
 * so selecting a directory and clicking Open appears to do nothing.
 *
 * This contribution re-registers a "Open Folder..." entry into the
 * File > Open menu group on all platforms, using FileDialogService
 * with `canSelectFolders: true` (the same pattern as ADD_FOLDER in
 * workspace-commands.js).
 */
import { injectable, inject } from '@theia/core/shared/inversify';
import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { FileDialogService } from '@theia/filesystem/lib/browser/file-dialog/file-dialog-service';
import { CommonMenus } from '@theia/core/lib/browser';
import { nls } from '@theia/core/lib/common/nls';
import URI from '@theia/core/lib/common/uri';

export namespace OpenFolderMenuCommands {
    export const OPEN_FOLDER: Command = {
        id: 'audesys.openFolder',
        category: 'File',
        label: nls.localizeByDefault('Open Folder...'),
    };
}

/**
 * Registers "Open Folder..." in the File menu for platforms where Theia
 * hides it (macOS browser mode, and browser mode in general).
 */
@injectable()
export class OpenFolderMenuContribution implements CommandContribution, MenuContribution {
    @inject(WorkspaceService) protected readonly workspaceService!: WorkspaceService;
    @inject(FileDialogService) protected readonly fileDialogService!: FileDialogService;

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(OpenFolderMenuCommands.OPEN_FOLDER, {
            execute: async () => {
                const selection = await this.fileDialogService.showOpenDialog({
                    title: nls.localizeByDefault('Open Folder'),
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                });
                if (!selection) {
                    return;
                }
                const uri = Array.isArray(selection) ? selection[0] : selection;
                await this.workspaceService.open(uri as URI);
            },
            isVisible: () => true,
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.FILE_OPEN, {
            commandId: OpenFolderMenuCommands.OPEN_FOLDER.id,
            label: nls.localizeByDefault('Open Folder...'),
            order: 'a02', // sits right after "Open..." (a00) / "Open File..." (a01)
        });
    }
}
