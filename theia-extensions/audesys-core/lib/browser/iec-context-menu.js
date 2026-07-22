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
exports.IecContextMenuContribution = exports.IecContextMenuCommands = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const selection_service_1 = require("@theia/core/lib/common/selection-service");
const selection_1 = require("@theia/core/lib/common/selection");
const message_service_1 = require("@theia/core/lib/common/message-service");
const inversify_2 = require("@theia/core/shared/inversify");
var IecContextMenuCommands;
(function (IecContextMenuCommands) {
    IecContextMenuCommands.CATEGORY = 'AUDESYS';
    IecContextMenuCommands.COMPILE = {
        id: 'audesys.compile',
        label: 'Compile',
        category: IecContextMenuCommands.CATEGORY,
    };
    IecContextMenuCommands.DEPLOY = {
        id: 'audesys.deploy',
        label: 'Deploy to Controller',
        category: IecContextMenuCommands.CATEGORY,
    };
    IecContextMenuCommands.VALIDATE = {
        id: 'audesys.validate',
        label: 'Validate IEC Program',
        category: IecContextMenuCommands.CATEGORY,
    };
})(IecContextMenuCommands || (exports.IecContextMenuCommands = IecContextMenuCommands = {}));
const IEC_EXTS = new Set(['.st', '.il', '.ld', '.fbd', '.sfc', '.gcode', '.nc', '.gco', '.hmi']);
/**
 * IEC Context Menu Contribution.
 * Adds Compile, Deploy, and Validate actions to the right-click context menu
 * in Theia's File Explorer (navigator) for IEC 61131-3, CNC, and HMI files.
 * These commands are stubs in Phase 3 — they log the target file and will be
 * wired to the actual compiler/deployment pipeline in subsequent tasks.
 */
let IecContextMenuContribution = class IecContextMenuContribution {
    registerCommands(registry) {
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
    registerMenus(menus) {
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
    isIecFileSelected() {
        const selection = this.selectionService.selection;
        const uri = selection_1.UriSelection.getUri(selection);
        if (!uri)
            return false;
        const name = uri.displayName.toLowerCase();
        return IEC_EXTS.has(this.resolveExt(name));
    }
    getSelectedFileName() {
        const selection = this.selectionService.selection;
        const uri = selection_1.UriSelection.getUri(selection);
        return uri ? uri.displayName : '<unknown>';
    }
    resolveExt(name) {
        const lower = name.toLowerCase();
        for (const ext of IEC_EXTS) {
            if (lower.endsWith(ext))
                return ext;
        }
        return '';
    }
    onCompile() {
        this.messageService.info(`[Stub] Compile: ${this.getSelectedFileName()} — compiler pipeline TBD`);
    }
    onDeploy() {
        this.messageService.info(`[Stub] Deploy: ${this.getSelectedFileName()} — deployment pipeline TBD`);
    }
    onValidate() {
        this.messageService.info(`[Stub] Validate: ${this.getSelectedFileName()} — validator TBD`);
    }
};
exports.IecContextMenuContribution = IecContextMenuContribution;
__decorate([
    (0, inversify_2.inject)(selection_service_1.SelectionService),
    __metadata("design:type", selection_service_1.SelectionService)
], IecContextMenuContribution.prototype, "selectionService", void 0);
__decorate([
    (0, inversify_2.inject)(message_service_1.MessageService),
    __metadata("design:type", message_service_1.MessageService)
], IecContextMenuContribution.prototype, "messageService", void 0);
exports.IecContextMenuContribution = IecContextMenuContribution = __decorate([
    (0, inversify_1.injectable)()
], IecContextMenuContribution);
//# sourceMappingURL=iec-context-menu.js.map