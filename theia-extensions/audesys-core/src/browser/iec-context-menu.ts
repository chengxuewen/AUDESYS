import { injectable } from '@theia/core/shared/inversify';
import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { SelectionService } from '@theia/core/lib/common/selection-service';
import URI from '@theia/core/lib/common/uri';
import { UriSelection } from '@theia/core/lib/common/selection';
import { MessageService } from '@theia/core/lib/common/message-service';
import { inject } from '@theia/core/shared/inversify';

export namespace IecContextMenuCommands {
    export const CATEGORY = 'AUDESYS';

    export const COMPILE: Command = {
        id: 'audesys.compile',
        label: 'Compile',
        category: CATEGORY,
    };
    export const DEPLOY: Command = {
        id: 'audesys.deploy',
        label: 'Deploy to Controller',
        category: CATEGORY,
    };
    export const VALIDATE: Command = {
        id: 'audesys.validate',
        label: 'Validate IEC Program',
        category: CATEGORY,
    };
}

const IEC_EXTS = new Set(['.st', '.il', '.ld', '.fbd', '.sfc', '.gcode', '.nc', '.gco', '.hmi']);

/**
 * IEC Context Menu Contribution.
 * Adds Compile, Deploy, and Validate actions to the right-click context menu
 * in Theia's File Explorer (navigator) for IEC 61131-3, CNC, and HMI files.
 * These commands are stubs in Phase 3 — they log the target file and will be
 * wired to the actual compiler/deployment pipeline in subsequent tasks.
 */
@injectable()
export class IecContextMenuContribution implements CommandContribution, MenuContribution {
    @inject(SelectionService) protected readonly selectionService!: SelectionService;
    @inject(MessageService) protected readonly messageService!: MessageService;

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(IecContextMenuCommands.COMPILE, {
            execute: () => this.onCompile(),
            isVisible: () => this.isIecFileSelected(),
        });
        registry.registerCommand(IecContextMenuCommands.DEPLOY, {
            execute: () => this.onDeploy(),
            isVisible: () => this.isIecFileSelected(),
        });
        registry.registerCommand(IecContextMenuCommands.VALIDATE, {
            execute: () => this.onValidate(),
            isVisible: () => this.isIecFileSelected(),
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        // Register in the navigator context menu (File Explorer right-click)
        menus.registerMenuAction(['navigator-context-menu', 'audesys-group'], {
            commandId: IecContextMenuCommands.COMPILE.id,
            label: 'Compile',
            order: '1',
        });
        menus.registerMenuAction(['navigator-context-menu', 'audesys-group'], {
            commandId: IecContextMenuCommands.DEPLOY.id,
            label: 'Deploy to Controller',
            order: '2',
        });
        menus.registerMenuAction(['navigator-context-menu', 'audesys-group'], {
            commandId: IecContextMenuCommands.VALIDATE.id,
            label: 'Validate IEC Program',
            order: '0',
        });
    }

    private isIecFileSelected(): boolean {
        const selection = this.selectionService.selection;
        const uri = UriSelection.getUri(selection);
        if (!uri) return false;
        const name = uri.displayName.toLowerCase();
        return IEC_EXTS.has(this.resolveExt(name));
    }

    private getSelectedFileName(): string {
        const selection = this.selectionService.selection;
        const uri = UriSelection.getUri(selection);
        return uri ? uri.displayName : '<unknown>';
    }

    private resolveExt(name: string): string {
        const lower = name.toLowerCase();
        for (const ext of IEC_EXTS) {
            if (lower.endsWith(ext)) return ext;
        }
        return '';
    }

    private onCompile(): void {
        this.messageService.info(`[Stub] Compile: ${this.getSelectedFileName()} — compiler pipeline TBD`);
    }

    private onDeploy(): void {
        this.messageService.info(`[Stub] Deploy: ${this.getSelectedFileName()} — deployment pipeline TBD`);
    }

    private onValidate(): void {
        this.messageService.info(`[Stub] Validate: ${this.getSelectedFileName()} — validator TBD`);
    }
}
