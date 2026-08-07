import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { QuickPickService, QuickInputService } from '@theia/core/lib/browser';
import { URI } from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { MessageService } from '@theia/core/lib/common/message-service';
import { PouType, PouLanguage } from './pou-wizard-model';
export declare namespace PouWizardCommands {
    const CATEGORY = "IEC 61131-3";
    const NEW_POU: Command;
}
/**
 * New POU Wizard (A1-4).
 * Multi-step creation: POU type → language → name, then writes a templated
 * file into the correct directory (Programs/FBs/Functions/GVL), creating the
 * directory on demand. Complements the flat per-language New File commands in
 * IecNewFileContribution (A1-1), which are left untouched.
 */
export declare class PouWizardContribution implements CommandContribution, MenuContribution {
    protected readonly fileService: FileService;
    protected readonly workspaceService: WorkspaceService;
    protected readonly messageService: MessageService;
    protected readonly quickPick: QuickPickService;
    protected readonly quickInput: QuickInputService;
    registerCommands(registry: CommandRegistry): void;
    registerMenus(menus: MenuModelRegistry): void;
    protected runWizard(): Promise<void>;
    protected pickType(): Promise<PouType | undefined>;
    protected pickLanguage(type: PouType): Promise<PouLanguage | undefined>;
    protected pickName(target: {
        dir: string;
        ext: string;
    }, dirUri: URI): Promise<string | undefined>;
    protected listChildren(dirUri: URI): Promise<string[]>;
}
//# sourceMappingURL=pou-wizard-contribution.d.ts.map