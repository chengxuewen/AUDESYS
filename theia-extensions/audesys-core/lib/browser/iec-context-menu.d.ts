import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { SelectionService } from '@theia/core/lib/common/selection-service';
import { MessageService } from '@theia/core/lib/common/message-service';
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
 * These commands are stubs in Phase 3 — they log the target file and will be
 * wired to the actual compiler/deployment pipeline in subsequent tasks.
 */
export declare class IecContextMenuContribution implements CommandContribution, MenuContribution {
    protected readonly selectionService: SelectionService;
    protected readonly messageService: MessageService;
    registerCommands(registry: CommandRegistry): void;
    registerMenus(menus: MenuModelRegistry): void;
    private isIecFileSelected;
    private getSelectedFileName;
    private resolveExt;
    private onCompile;
    private onDeploy;
    private onValidate;
}
//# sourceMappingURL=iec-context-menu.d.ts.map