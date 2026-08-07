import { injectable, inject } from '@theia/core/shared/inversify';
import {
    Command, CommandContribution, CommandRegistry,
    MenuContribution, MenuModelRegistry,
} from '@theia/core/lib/common';
import { CommonMenus, QuickPickService, QuickInputService } from '@theia/core/lib/browser';
import { URI } from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { MessageService } from '@theia/core/lib/common/message-service';
import { BinaryBuffer } from '@theia/core/lib/common/buffer';
import { QuickPickValue } from '@theia/core/lib/common/quick-pick-service';
import {
    POU_TYPES, PouType, PouLanguage,
    languagesFor, pouTarget, validatePouName,
} from './pou-wizard-model';

export namespace PouWizardCommands {
    export const CATEGORY = 'IEC 61131-3';

    export const NEW_POU: Command = {
        id: 'audesys.new.pou',
        label: 'New POU Wizard\u2026',
        category: CATEGORY,
    };
}

const TYPE_LABEL: Readonly<Record<PouType, string>> = {
    Program: 'Program',
    FunctionBlock: 'Function Block',
    Function: 'Function',
    GVL: 'Global Variable List',
};

const LANGUAGE_LABEL: Readonly<Record<PouLanguage, string>> = {
    ST: 'Structured Text (.st)',
    IL: 'Instruction List (.il)',
    GVL: 'Global Variable List (.gvl)',
};

/**
 * New POU Wizard (A1-4).
 * Multi-step creation: POU type → language → name, then writes a templated
 * file into the correct directory (Programs/FBs/Functions/GVL), creating the
 * directory on demand. Complements the flat per-language New File commands in
 * IecNewFileContribution (A1-1), which are left untouched.
 */
@injectable()
export class PouWizardContribution implements CommandContribution, MenuContribution {
    @inject(FileService) protected readonly fileService!: FileService;
    @inject(WorkspaceService) protected readonly workspaceService!: WorkspaceService;
    @inject(MessageService) protected readonly messageService!: MessageService;
    @inject(QuickPickService) protected readonly quickPick!: QuickPickService;
    @inject(QuickInputService) protected readonly quickInput!: QuickInputService;

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(PouWizardCommands.NEW_POU, {
            execute: () => this.runWizard(),
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerSubmenu(CommonMenus.FILE_NEW, 'IEC 61131-3');
        const menu = [...CommonMenus.FILE_NEW, 'IEC 61131-3'];
        menus.registerMenuAction(menu, {
            commandId: PouWizardCommands.NEW_POU.id,
            label: 'New POU Wizard\u2026',
            order: '0',
        });
    }

    protected async runWizard(): Promise<void> {
        const workspaceRoot = this.workspaceService.tryGetRoots()[0];
        if (!workspaceRoot) {
            this.messageService.warn('No workspace folder open. Open a project first.');
            return;
        }
        try {
            const type = await this.pickType();
            if (!type) {
                return;
            }
            const language = await this.pickLanguage(type);
            if (!language) {
                return;
            }
            const target = pouTarget(type, language);
            const dirUri = workspaceRoot.resource.resolve(target.dir);
            const name = await this.pickName(target, dirUri);
            if (!name) {
                return;
            }
            if (!(await this.fileService.exists(dirUri))) {
                await this.fileService.createFolder(dirUri);
            }
            const fileUri = dirUri.resolve(`${name}${target.ext}`);
            await this.fileService.writeFile(fileUri, BinaryBuffer.fromString(target.template(name)));
            this.messageService.info(`Created ${TYPE_LABEL[type]} ${name}${target.ext} in ${target.dir}/`);
        } catch (e) {
            this.messageService.error(`Failed to create POU: ${String(e)}`);
        }
    }

    protected async pickType(): Promise<PouType | undefined> {
        const items = POU_TYPES.map<QuickPickValue<PouType>>(t => ({
            label: TYPE_LABEL[t],
            description: pouTarget(t, languagesFor(t)[0]).dir + '/',
            value: t,
        }));
        const picked = await this.quickPick.show(items, {
            title: 'New POU Wizard',
            step: 1,
            totalSteps: 3,
            placeholder: 'Select a POU type',
        });
        return picked?.value;
    }

    protected async pickLanguage(type: PouType): Promise<PouLanguage | undefined> {
        const options = languagesFor(type);
        if (options.length === 1) {
            return options[0];
        }
        const items = [...options].map<QuickPickValue<PouLanguage>>(lang => ({
            label: LANGUAGE_LABEL[lang],
            value: lang,
        }));
        const picked = await this.quickPick.show(items, {
            title: 'New POU Wizard',
            step: 2,
            totalSteps: 3,
            placeholder: `Select a language for ${TYPE_LABEL[type]}`,
        });
        return picked?.value;
    }

    protected async pickName(target: { dir: string; ext: string }, dirUri: URI): Promise<string | undefined> {
        const taken = new Set<string>();
        if (await this.fileService.exists(dirUri)) {
            for (const child of await this.listChildren(dirUri)) {
                taken.add(child);
            }
        }
        return this.quickInput.input({
            title: 'New POU Wizard',
            prompt: `Name for the new ${target.ext} file in ${target.dir}/`,
            placeHolder: 'e.g. Main',
            validateInput: async (value) => {
                const trimmed = value.trim();
                if (!validatePouName(trimmed)) {
                    return 'Must be a valid IEC identifier (letter/underscore, then letters/digits/underscores).';
                }
                if (taken.has(`${trimmed}${target.ext}`)) {
                    return `A file named ${trimmed}${target.ext} already exists in ${target.dir}/.`;
                }
                return undefined;
            },
        }).then(value => value?.trim() || undefined);
    }

    protected async listChildren(dirUri: URI): Promise<string[]> {
        const stat = await this.fileService.resolve(dirUri);
        return (stat?.children ?? []).map(c => c.name);
    }
}