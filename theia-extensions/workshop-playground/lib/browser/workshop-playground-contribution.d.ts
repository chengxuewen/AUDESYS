import { CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core';
import { MessageService } from '@theia/core';
/**
 * AUDESYS Workshop: Hello World Command
 *
 * Demonstrates:
 *   - Command definition with id + label
 *   - CommandContribution interface
 *   - @injectable() decorator for DI
 *   - @inject() for service injection
 */
export declare const HelloWorldCommand: {
    id: string;
    label: string;
};
export declare const AboutWorkshopCommand: {
    id: string;
    label: string;
};
/**
 * WorkshopPlaygroundCommandContribution
 *
 * Implements both CommandContribution AND MenuContribution.
 * This is a common Theia pattern — one class can implement multiple contribution
 * interfaces to keep related logic together.
 */
export declare class WorkshopPlaygroundCommandContribution implements CommandContribution, MenuContribution {
    private readonly messageService;
    constructor(messageService: MessageService);
    /**
     * registerCommands is called by Theia's CommandRegistry at startup.
     * Use this to register command IDs and their handlers.
     */
    registerCommands(registry: CommandRegistry): void;
    /**
     * registerMenus is called by Theia's MenuModelRegistry at startup.
     * Use this to add menu items that trigger your commands.
     *
     * CommonMenus.HELP is the "Help" top-level menu path.
     */
    registerMenus(menus: MenuModelRegistry): void;
}
//# sourceMappingURL=workshop-playground-contribution.d.ts.map