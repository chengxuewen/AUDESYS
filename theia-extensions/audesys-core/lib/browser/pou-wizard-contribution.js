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
exports.PouWizardContribution = exports.PouWizardCommands = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const browser_1 = require("@theia/core/lib/browser");
const file_service_1 = require("@theia/filesystem/lib/browser/file-service");
const workspace_service_1 = require("@theia/workspace/lib/browser/workspace-service");
const message_service_1 = require("@theia/core/lib/common/message-service");
const buffer_1 = require("@theia/core/lib/common/buffer");
const pou_wizard_model_1 = require("./pou-wizard-model");
var PouWizardCommands;
(function (PouWizardCommands) {
    PouWizardCommands.CATEGORY = 'IEC 61131-3';
    PouWizardCommands.NEW_POU = {
        id: 'audesys.new.pou',
        label: 'New POU Wizard\u2026',
        category: PouWizardCommands.CATEGORY,
    };
})(PouWizardCommands || (exports.PouWizardCommands = PouWizardCommands = {}));
const TYPE_LABEL = {
    Program: 'Program',
    FunctionBlock: 'Function Block',
    Function: 'Function',
    GVL: 'Global Variable List',
};
const LANGUAGE_LABEL = {
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
let PouWizardContribution = class PouWizardContribution {
    registerCommands(registry) {
        registry.registerCommand(PouWizardCommands.NEW_POU, {
            execute: () => this.runWizard(),
        });
    }
    registerMenus(menus) {
        menus.registerSubmenu(browser_1.CommonMenus.FILE_NEW, 'IEC 61131-3');
        const menu = [...browser_1.CommonMenus.FILE_NEW, 'IEC 61131-3'];
        menus.registerMenuAction(menu, {
            commandId: PouWizardCommands.NEW_POU.id,
            label: 'New POU Wizard\u2026',
            order: '0',
        });
    }
    async runWizard() {
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
            const target = (0, pou_wizard_model_1.pouTarget)(type, language);
            const dirUri = workspaceRoot.resource.resolve(target.dir);
            const name = await this.pickName(target, dirUri);
            if (!name) {
                return;
            }
            if (!(await this.fileService.exists(dirUri))) {
                await this.fileService.createFolder(dirUri);
            }
            const fileUri = dirUri.resolve(`${name}${target.ext}`);
            await this.fileService.writeFile(fileUri, buffer_1.BinaryBuffer.fromString(target.template(name)));
            this.messageService.info(`Created ${TYPE_LABEL[type]} ${name}${target.ext} in ${target.dir}/`);
        }
        catch (e) {
            this.messageService.error(`Failed to create POU: ${String(e)}`);
        }
    }
    async pickType() {
        const items = pou_wizard_model_1.POU_TYPES.map(t => ({
            label: TYPE_LABEL[t],
            description: (0, pou_wizard_model_1.pouTarget)(t, (0, pou_wizard_model_1.languagesFor)(t)[0]).dir + '/',
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
    async pickLanguage(type) {
        const options = (0, pou_wizard_model_1.languagesFor)(type);
        if (options.length === 1) {
            return options[0];
        }
        const items = [...options].map(lang => ({
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
    async pickName(target, dirUri) {
        const taken = new Set();
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
                if (!(0, pou_wizard_model_1.validatePouName)(trimmed)) {
                    return 'Must be a valid IEC identifier (letter/underscore, then letters/digits/underscores).';
                }
                if (taken.has(`${trimmed}${target.ext}`)) {
                    return `A file named ${trimmed}${target.ext} already exists in ${target.dir}/.`;
                }
                return undefined;
            },
        }).then(value => value?.trim() || undefined);
    }
    async listChildren(dirUri) {
        const stat = await this.fileService.resolve(dirUri);
        return (stat?.children ?? []).map(c => c.name);
    }
};
exports.PouWizardContribution = PouWizardContribution;
__decorate([
    (0, inversify_1.inject)(file_service_1.FileService),
    __metadata("design:type", file_service_1.FileService)
], PouWizardContribution.prototype, "fileService", void 0);
__decorate([
    (0, inversify_1.inject)(workspace_service_1.WorkspaceService),
    __metadata("design:type", workspace_service_1.WorkspaceService)
], PouWizardContribution.prototype, "workspaceService", void 0);
__decorate([
    (0, inversify_1.inject)(message_service_1.MessageService),
    __metadata("design:type", message_service_1.MessageService)
], PouWizardContribution.prototype, "messageService", void 0);
__decorate([
    (0, inversify_1.inject)(browser_1.QuickPickService),
    __metadata("design:type", Object)
], PouWizardContribution.prototype, "quickPick", void 0);
__decorate([
    (0, inversify_1.inject)(browser_1.QuickInputService),
    __metadata("design:type", Object)
], PouWizardContribution.prototype, "quickInput", void 0);
exports.PouWizardContribution = PouWizardContribution = __decorate([
    (0, inversify_1.injectable)()
], PouWizardContribution);
//# sourceMappingURL=pou-wizard-contribution.js.map