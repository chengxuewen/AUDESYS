// ModeFilteredCommand — utility to gate command execution by current StudioMode

import { Command } from '@theia/core/lib/common';
import { StudioMode, AudesysModeManager } from './audesys-mode-manager';

/**
 * Creates a Theia command handler that only executes when the current
 * mode matches one of the allowedModes. The command's isEnabled()
 * returns false for disallowed modes, greying out toolbar buttons.
 *
 * Usage:
 *   registry.registerCommand(command, createModeFilteredHandler(
 *     modeManager, command, ['edit'], () => { doDeploy(); }
 *   ));
 */
export function createModeFilteredHandler(
    modeManager: AudesysModeManager,
    command: Command,
    allowedModes: StudioMode[],
    execute: () => void,
): { execute: () => void; isEnabled: () => boolean } {
    return {
        execute: () => {
            if (allowedModes.includes(modeManager.mode)) {
                execute();
            }
        },
        isEnabled: () => allowedModes.includes(modeManager.mode),
    };
}
