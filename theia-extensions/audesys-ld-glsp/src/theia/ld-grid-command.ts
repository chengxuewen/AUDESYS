import { inject, injectable } from '@theia/core/shared/inversify';
import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { KeybindingContribution, KeybindingRegistry } from '@theia/core/lib/browser/keybinding';
import { WidgetManager } from '@theia/core/lib/browser/widget-manager';
import { ShowGridAction } from '@eclipse-glsp/client';

export const TOGGLE_GRID_COMMAND: Command = {
    id: 'audesys-ld.toggle-grid',
    label: 'LD: Toggle Grid',
    category: 'LD Editor',
};

@injectable()
export class LdGridCommandContribution implements CommandContribution, KeybindingContribution {
    @inject(WidgetManager)
    protected readonly widgetManager!: WidgetManager;

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(TOGGLE_GRID_COMMAND, {
            execute: async () => {
                const widget = await this.widgetManager.tryGetWidget('glsp-ld-diagram');
                if (!widget) return;
                // The GLSP diagram widget exposes the diagramServer (action dispatcher).
                // ShowGridAction is client-side feedback — GridManager handles it locally.
                const diagramServer = (widget as any).diagramServer;
                const actionDispatcher = diagramServer?.actionDispatcher;
                if (actionDispatcher) {
                    // Query current visibility from the graph root CSS class
                    const root = (widget as any).modelRoot;
                    const visible = root?.cssClasses?.includes('grid-background') ?? false;
                    actionDispatcher.dispatch(ShowGridAction.create({ show: !visible }));
                }
            },
        });
    }

    registerKeybindings(registry: KeybindingRegistry): void {
        registry.registerKeybinding({
            command: TOGGLE_GRID_COMMAND.id,
            keybinding: 'ctrlcmd+g',
        });
    }
}
