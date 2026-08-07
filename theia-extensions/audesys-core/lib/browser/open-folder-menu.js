"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenFolderMenuContribution = exports.OpenFolderMenuCommands = void 0;
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
const inversify_1 = require("@theia/core/shared/inversify");
const workspace_service_1 = require("@theia/workspace/lib/browser/workspace-service");
const file_dialog_service_1 = require("@theia/filesystem/lib/browser/file-dialog/file-dialog-service");
const browser_1 = require("@theia/core/lib/browser");
const nls_1 = require("@theia/core/lib/common/nls");
var OpenFolderMenuCommands;
(function (OpenFolderMenuCommands) {
    OpenFolderMenuCommands.OPEN_FOLDER = {
        id: 'audesys.openFolder',
        category: 'File',
        label: nls_1.nls.localizeByDefault('Open Folder...'),
    };
})(OpenFolderMenuCommands || (exports.OpenFolderMenuCommands = OpenFolderMenuCommands = {}));
/**
 * Registers "Open Folder..." in the File menu for platforms where Theia
 * hides it (macOS browser mode, and browser mode in general).
 */
let OpenFolderMenuContribution = class OpenFolderMenuContribution {
    registerCommands(registry) {
        registry.registerCommand(OpenFolderMenuCommands.OPEN_FOLDER, {
            execute: async () => {
                const selection = await this.fileDialogService.showOpenDialog({
                    title: nls_1.nls.localizeByDefault('Open Folder'),
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                });
                if (!selection) {
                    return;
                }
                const uri = Array.isArray(selection) ? selection[0] : selection;
                await this.workspaceService.open(uri);
            },
            isVisible: () => true,
        });
    }
    registerMenus(menus) {
        menus.registerMenuAction(browser_1.CommonMenus.FILE_OPEN, {
            commandId: OpenFolderMenuCommands.OPEN_FOLDER.id,
            label: nls_1.nls.localizeByDefault('Open Folder...'),
            order: 'a02', // sits right after "Open..." (a00) / "Open File..." (a01)
        });
    }
};
exports.OpenFolderMenuContribution = OpenFolderMenuContribution;
__decorate([
    (0, inversify_1.inject)(workspace_service_1.WorkspaceService),
    __metadata("design:type", workspace_service_1.WorkspaceService)
], OpenFolderMenuContribution.prototype, "workspaceService", void 0);
__decorate([
    (0, inversify_1.inject)(file_dialog_service_1.FileDialogService),
    __metadata("design:type", Object)
], OpenFolderMenuContribution.prototype, "fileDialogService", void 0);
exports.OpenFolderMenuContribution = OpenFolderMenuContribution = __decorate([
    (0, inversify_1.injectable)()
], OpenFolderMenuContribution);
//# sourceMappingURL=open-folder-menu.js.map