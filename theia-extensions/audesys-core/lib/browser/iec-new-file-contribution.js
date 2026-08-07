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
exports.IecNewFileContribution = exports.IecNewFileCommands = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const browser_1 = require("@theia/core/lib/browser");
const file_service_1 = require("@theia/filesystem/lib/browser/file-service");
const workspace_service_1 = require("@theia/workspace/lib/browser/workspace-service");
const message_service_1 = require("@theia/core/lib/common/message-service");
const buffer_1 = require("@theia/core/lib/common/buffer");
const iec_conventions_1 = require("./iec-conventions");
var IecNewFileCommands;
(function (IecNewFileCommands) {
    IecNewFileCommands.CATEGORY = 'IEC 61131-3';
    IecNewFileCommands.NEW_ST = {
        id: 'audesys.new.st',
        label: 'New Structured Text (ST) File',
        category: IecNewFileCommands.CATEGORY,
    };
    IecNewFileCommands.NEW_IL = {
        id: 'audesys.new.il',
        label: 'New Instruction List (IL) File',
        category: IecNewFileCommands.CATEGORY,
    };
    IecNewFileCommands.NEW_LD = {
        id: 'audesys.new.ld',
        label: 'New Ladder Diagram (LD) File',
        category: IecNewFileCommands.CATEGORY,
    };
    IecNewFileCommands.NEW_FBD = {
        id: 'audesys.new.fbd',
        label: 'New Function Block Diagram (FBD) File',
        category: IecNewFileCommands.CATEGORY,
    };
    IecNewFileCommands.NEW_SFC = {
        id: 'audesys.new.sfc',
        label: 'New Sequential Function Chart (SFC) File',
        category: IecNewFileCommands.CATEGORY,
    };
    IecNewFileCommands.NEW_GVL = {
        id: 'audesys.new.gvl',
        label: 'New Global Variable List (GVL) File',
        category: IecNewFileCommands.CATEGORY,
    };
    IecNewFileCommands.NEW_HMI = {
        id: 'audesys.new.hmi',
        label: 'New HMI Layout File',
        category: IecNewFileCommands.CATEGORY,
    };
    IecNewFileCommands.NEW_GCODE = {
        id: 'audesys.new.gcode',
        label: 'New G-code CNC File',
        category: IecNewFileCommands.CATEGORY,
    };
})(IecNewFileCommands || (exports.IecNewFileCommands = IecNewFileCommands = {}));
const IEC_TEMPLATES = [
    { command: IecNewFileCommands.NEW_ST, ext: '.st', template: '(* Structured Text Program *)\n\nPROGRAM Main\nVAR\n    (* variables *)\nEND_VAR\n\n(* code *)\n\nEND_PROGRAM\n' },
    { command: IecNewFileCommands.NEW_IL, ext: '.il', template: '(* Instruction List Program *)\n\nLD TRUE\nST result\n' },
    { command: IecNewFileCommands.NEW_LD, ext: '.ld', template: '{"id":"untitled","nodes":[],"edges":[],"rungs":[]}' },
    { command: IecNewFileCommands.NEW_FBD, ext: '.fbd', template: '{"id":"untitled","nodes":[],"edges":[]}' },
    { command: IecNewFileCommands.NEW_SFC, ext: '.sfc', template: '(* Sequential Function Chart — placeholder *)\n' },
    { command: IecNewFileCommands.NEW_GVL, ext: '.gvl', template: '(* Global Variable List *)\n\nVAR_GLOBAL\n    (* global variables *)\nEND_VAR\n' },
    { command: IecNewFileCommands.NEW_HMI, ext: '.hmi', template: '# HMI Layout\nwidgets: []\n' },
    { command: IecNewFileCommands.NEW_GCODE, ext: '.gcode', template: '; G-code CNC Program\nG21 ; mm units\nG90 ; absolute positioning\nG0 X0 Y0 Z0\nM30\n' },
];
/**
 * IEC New File Contribution.
 * Adds New File wizard entries for all IEC 61131-3 languages, HMI, and CNC
 * in the File > New menu of Theia, writing each into its directory-convention
 * subdirectory (Programs/GVL/Hmi/Cnc).
 */
let IecNewFileContribution = class IecNewFileContribution {
    registerCommands(registry) {
        for (const entry of IEC_TEMPLATES) {
            registry.registerCommand(entry.command, {
                execute: async () => {
                    const workspaceRoot = this.workspaceService.tryGetRoots()[0];
                    if (!workspaceRoot) {
                        this.messageService.warn('No workspace folder open. Open a project first.');
                        return;
                    }
                    try {
                        const dirName = iec_conventions_1.IEC_LANG_DIR[entry.ext];
                        const dirUri = dirName
                            ? workspaceRoot.resource.resolve(dirName)
                            : workspaceRoot.resource;
                        if (!(await this.fileService.exists(dirUri))) {
                            await this.fileService.createFolder(dirUri);
                        }
                        // Auto-increment within the subdirectory: untitled.ld → untitled-1.ld → ...
                        let target = dirUri.resolve(`untitled${entry.ext}`);
                        let counter = 0;
                        while (await this.fileService.exists(target) && counter < 100) {
                            counter++;
                            target = dirUri.resolve(`untitled-${counter}${entry.ext}`);
                        }
                        await this.fileService.writeFile(target, buffer_1.BinaryBuffer.fromString(entry.template));
                        this.messageService.info(`Created: ${target.displayName}`);
                    }
                    catch (e) {
                        this.messageService.error(`Failed to create file: ${String(e)}`);
                    }
                },
            });
        }
    }
    registerMenus(menus) {
        // IEC 61131-3 submenu under File > New
        menus.registerSubmenu(browser_1.CommonMenus.FILE_NEW, 'IEC 61131-3');
        const menu = [...browser_1.CommonMenus.FILE_NEW, 'IEC 61131-3'];
        const actions = [
            { command: IecNewFileCommands.NEW_ST, label: 'Structured Text (.st)', order: 'a' },
            { command: IecNewFileCommands.NEW_IL, label: 'Instruction List (.il)', order: 'b' },
            { command: IecNewFileCommands.NEW_LD, label: 'Ladder Diagram (.ld)', order: 'c' },
            { command: IecNewFileCommands.NEW_FBD, label: 'Function Block Diagram (.fbd)', order: 'd' },
            { command: IecNewFileCommands.NEW_SFC, label: 'Sequential Function Chart (.sfc)', order: 'e' },
            { command: IecNewFileCommands.NEW_GVL, label: 'Global Variable List (.gvl)', order: 'f' },
            { command: IecNewFileCommands.NEW_HMI, label: 'HMI Layout (.hmi)', order: 'g' },
            { command: IecNewFileCommands.NEW_GCODE, label: 'G-code CNC (.gcode)', order: 'h' },
        ];
        for (const action of actions) {
            menus.registerMenuAction(menu, {
                commandId: action.command.id,
                label: action.label,
                order: action.order,
            });
        }
    }
};
exports.IecNewFileContribution = IecNewFileContribution;
__decorate([
    (0, inversify_1.inject)(file_service_1.FileService),
    __metadata("design:type", file_service_1.FileService)
], IecNewFileContribution.prototype, "fileService", void 0);
__decorate([
    (0, inversify_1.inject)(workspace_service_1.WorkspaceService),
    __metadata("design:type", workspace_service_1.WorkspaceService)
], IecNewFileContribution.prototype, "workspaceService", void 0);
__decorate([
    (0, inversify_1.inject)(message_service_1.MessageService),
    __metadata("design:type", message_service_1.MessageService)
], IecNewFileContribution.prototype, "messageService", void 0);
exports.IecNewFileContribution = IecNewFileContribution = __decorate([
    (0, inversify_1.injectable)()
], IecNewFileContribution);
//# sourceMappingURL=iec-new-file-contribution.js.map