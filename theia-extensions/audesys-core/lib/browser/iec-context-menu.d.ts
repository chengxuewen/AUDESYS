import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { SelectionService } from '@theia/core/lib/common/selection-service';
import { MessageService } from '@theia/core/lib/common/message-service';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
export declare namespace IecContextMenuCommands {
    const CATEGORY = "AUDESYS";
    const COMPILE: Command;
    const DEPLOY: Command;
    const VALIDATE: Command;
}
/**
 * IEC Context Menu Contribution.
 * Adds Compile, Deploy, and Validate actions to the right-click context menu
 * in Theia's File Explorer (navigator) for IEC 61131-3, CNC, and HMI files.
 * Compile is wired to the napi-rs bridge; Deploy/Validate are P1 stubs.
 */
export declare class IecContextMenuContribution implements CommandContribution, MenuContribution {
    protected readonly selectionService: SelectionService;
    protected readonly messageService: MessageService;
    protected readonly fileService: FileService;
    registerCommands(registry: CommandRegistry): void;
    registerMenus(menus: MenuModelRegistry): void;
    private isIecFileSelected;
    private getSelectedUri;
    private resolveExt;
    private onCompile;
    private onDeploy;
    private onValidate;
    /** Map extension to bridge compile function. Returns null for unsupported types. */
    private getCompileFn;
    private getSocketPath;
    private getSecret;
}
//# sourceMappingURL=iec-context-menu.d.ts.map