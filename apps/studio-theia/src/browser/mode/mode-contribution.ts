// ModeContribution — wires mode manager lifecycle into Theia app startup

import { injectable, inject } from '@theia/core/shared/inversify';
import {
    FrontendApplicationContribution,
    FrontendApplication,
} from '@theia/core/lib/browser';
import {
    CommandContribution,
    CommandRegistry,
    Command,
} from '@theia/core/lib/common';
import { AudesysModeManager } from './audesys-mode-manager';
import { ModeStatusBarItem } from './mode-status-bar-item';

export namespace ModeCommands {
    export const CATEGORY = 'Mode';

    export const SWITCH_EDIT: Command = {
        id: 'audesys.mode.switch.edit',
        label: 'Switch to Edit Mode',
        category: CATEGORY,
    };
    export const SWITCH_DEBUG: Command = {
        id: 'audesys.mode.switch.debug',
        label: 'Switch to Debug Mode',
        category: CATEGORY,
    };
    export const SWITCH_COMMISSIONING: Command = {
        id: 'audesys.mode.switch.commissioning',
        label: 'Switch to Commissioning Mode',
        category: CATEGORY,
    };
}

/**
 * Frontend application contribution that:
 *  1. Initializes the AudesysModeManager from persisted preference on startup.
 *  2. Renders mode indicator entries in the status bar.
 *  3. Registers mode-switch commands (Edit / Debug / Commissioning).
 */
@injectable()
export class ModeContribution implements FrontendApplicationContribution, CommandContribution {
    @inject(AudesysModeManager)
    private readonly modeManager!: AudesysModeManager;

    @inject(ModeStatusBarItem)
    private readonly statusBarItem!: ModeStatusBarItem;

    onStart(_app: FrontendApplication): void {
        this.modeManager.init();
        this.statusBarItem.show();
    }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(ModeCommands.SWITCH_EDIT, {
            execute: () => this.modeManager.switchMode('edit'),
        });
        registry.registerCommand(ModeCommands.SWITCH_DEBUG, {
            execute: () => this.modeManager.switchMode('debug'),
        });
        registry.registerCommand(ModeCommands.SWITCH_COMMISSIONING, {
            execute: () => this.modeManager.switchMode('commissioning'),
        });
    }
}
