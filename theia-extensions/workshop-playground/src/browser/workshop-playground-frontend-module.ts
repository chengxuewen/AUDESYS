import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution, MenuContribution } from '@theia/core';
import { WebSocketConnectionProvider } from '@theia/core/lib/browser';
import { WorkshopPlaygroundCommandContribution } from './workshop-playground-contribution';

/**
 * Workshop Playground Frontend Module
 *
 * Demonstrates:
 *   1. InversifyJS ContainerModule — the standard DI entry point
 *   2. bind(Interface).to(Implementation) — singleton by default
 *   3. Multiple contributions registered in one module
 */

export default new ContainerModule((bind) => {
    // CommandContribution: registers custom commands
    bind(CommandContribution).to(WorkshopPlaygroundCommandContribution);

    // MenuContribution: adds menu items to existing menus
    // Using the same class that implements both interfaces (DRY pattern)
    bind(MenuContribution).to(WorkshopPlaygroundCommandContribution);
});
