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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkshopPlaygroundCommandContribution = exports.AboutWorkshopCommand = exports.HelloWorldCommand = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const browser_1 = require("@theia/core/lib/browser");
const core_1 = require("@theia/core");
/**
 * AUDESYS Workshop: Hello World Command
 *
 * Demonstrates:
 *   - Command definition with id + label
 *   - CommandContribution interface
 *   - @injectable() decorator for DI
 *   - @inject() for service injection
 */
exports.HelloWorldCommand = {
    id: 'audesys.workshop.helloWorld',
    label: 'AudESYS: Hello World',
};
exports.AboutWorkshopCommand = {
    id: 'audesys.workshop.about',
    label: 'About AUDESYS Workshop',
};
/**
 * WorkshopPlaygroundCommandContribution
 *
 * Implements both CommandContribution AND MenuContribution.
 * This is a common Theia pattern — one class can implement multiple contribution
 * interfaces to keep related logic together.
 */
let WorkshopPlaygroundCommandContribution = class WorkshopPlaygroundCommandContribution {
    constructor(messageService) {
        this.messageService = messageService;
    }
    /**
     * registerCommands is called by Theia's CommandRegistry at startup.
     * Use this to register command IDs and their handlers.
     */
    registerCommands(registry) {
        registry.registerCommand(exports.HelloWorldCommand, {
            execute: () => {
                this.messageService.info('Hello from AUDESYS Workshop Playground! \n\n' +
                    'This extension demonstrates:\n' +
                    '• inversify Dependency Injection\n' +
                    '• CommandContribution + MenuContribution\n' +
                    '• Monarch tokenizer for .audesys files\n\n' +
                    '👷 Built as part of the Theia Learning Workshop');
            },
        });
        registry.registerCommand(exports.AboutWorkshopCommand, {
            execute: () => {
                this.messageService.info('AUDESYS Theia Workshop Playground\n\n' +
                    'Version: 0.1.0 (learning exercise)\n' +
                    'Purpose: Teach the AUDESYS team Eclipse Theia fundamentals\n' +
                    'Topics: DI, Contributions, GLSP, Monarch\n\n' +
                    'Projects:\n' +
                    '- audeSYS Studio Theia (apps/studio-theia/)\n' +
                    '- audeSYS Core Extension (theia-extensions/audesys-core/)\n' +
                    '- Workshop Playground (theia-extensions/workshop-playground/)');
            },
        });
    }
    /**
     * registerMenus is called by Theia's MenuModelRegistry at startup.
     * Use this to add menu items that trigger your commands.
     *
     * CommonMenus.HELP is the "Help" top-level menu path.
     */
    registerMenus(menus) {
        menus.registerMenuAction(browser_1.CommonMenus.HELP, {
            commandId: exports.AboutWorkshopCommand.id,
            label: 'About AUDESYS Workshop',
            order: 'a', // first in the menu
        });
    }
};
exports.WorkshopPlaygroundCommandContribution = WorkshopPlaygroundCommandContribution;
exports.WorkshopPlaygroundCommandContribution = WorkshopPlaygroundCommandContribution = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)(core_1.MessageService)),
    __metadata("design:paramtypes", [core_1.MessageService])
], WorkshopPlaygroundCommandContribution);
//# sourceMappingURL=workshop-playground-contribution.js.map