import { injectable, inject } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core';
import { CommonMenus } from '@theia/core/lib/browser';
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

export const HelloWorldCommand = {
    id: 'audesys.workshop.helloWorld',
    label: 'AudESYS: Hello World',
};

export const AboutWorkshopCommand = {
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
@injectable()
export class WorkshopPlaygroundCommandContribution implements CommandContribution, MenuContribution {

    constructor(
        @inject(MessageService) private readonly messageService: MessageService,
    ) {}

    /**
     * registerCommands is called by Theia's CommandRegistry at startup.
     * Use this to register command IDs and their handlers.
     */
    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(HelloWorldCommand, {
            execute: () => {
                this.messageService.info(
                    'Hello from AUDESYS Workshop Playground! \n\n' +
                    'This extension demonstrates:\n' +
                    '• inversify Dependency Injection\n' +
                    '• CommandContribution + MenuContribution\n' +
                    '• Monarch tokenizer for .audesys files\n\n' +
                    '👷 Built as part of the Theia Learning Workshop'
                );
            },
        });

        registry.registerCommand(AboutWorkshopCommand, {
            execute: () => {
                this.messageService.info(
                    'AUDESYS Theia Workshop Playground\n\n' +
                    'Version: 0.1.0 (learning exercise)\n' +
                    'Purpose: Teach the AUDESYS team Eclipse Theia fundamentals\n' +
                    'Topics: DI, Contributions, GLSP, Monarch\n\n' +
                    'Projects:\n' +
                    '- audeSYS Studio Theia (apps/studio-theia/)\n' +
                    '- audeSYS Core Extension (theia-extensions/audesys-core/)\n' +
                    '- Workshop Playground (theia-extensions/workshop-playground/)'
                );
            },
        });
    }

    /**
     * registerMenus is called by Theia's MenuModelRegistry at startup.
     * Use this to add menu items that trigger your commands.
     *
     * CommonMenus.HELP is the "Help" top-level menu path.
     */
    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.HELP, {
            commandId: AboutWorkshopCommand.id,
            label: 'About AUDESYS Workshop',
            order: 'a', // first in the menu
        });
    }
}
