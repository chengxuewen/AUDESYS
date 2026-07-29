/**
 * LD Palette Contribution — registers the LD tool palette widget in the
 * Theia frontend application shell (left panel).
 *
 * This contribution:
 * 1. Creates the LdPaletteWidget on startup
 * 2. Places it in the left panel area
 * 3. Binds the LdToolState as a singleton for dependency injection
 */

import { injectable, inject } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution, FrontendApplication } from '@theia/core/lib/browser';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { LdToolState } from './ld-tool-state';
import { LdPaletteWidget } from './ld-palette-widget';

export const LD_PALETTE_TOGGLE_COMMAND = {
    id: 'audesys.ld.togglePalette',
    label: 'LD: Toggle Tool Palette',
};

/**
 * Contribution that adds the LD tool palette to the left panel at startup.
 */
@injectable()
export class LdPaletteContribution implements FrontendApplicationContribution {

    constructor(
        @inject(ApplicationShell) private readonly shell: ApplicationShell,
        @inject(LdToolState) private readonly toolState: LdToolState,
    ) {}

    /**
     * Called after the application shell is attached and when there is no
     * previous layout state to restore (initializeLayout).
     *
     * This ensures the palette appears on first launch but respects
     * saved layouts on subsequent launches.
     */
    async initializeLayout(app: FrontendApplication): Promise<void> {
        await this.openPalette();
    }

    /**
     * Called every startup after shell layout is ready.
     * Ensures palette is visible even when layout is restored from saved state.
     * @see https://theia-ide.org/docs/frontend_application_contribution/
     */
    async onDidInitializeLayout(app: FrontendApplication): Promise<void> {
        if (!this.shell.getWidgetById(LdPaletteWidget.ID)) {
            await this.openPalette();
        }
    }

    private async openPalette(): Promise<void> {
        const widget = new LdPaletteWidget(this.toolState);
        await this.shell.addWidget(widget, {
            area: 'left',
            rank: 200, // ponytail: after file explorer (~100), before outline (~300)
        });
    }
}
