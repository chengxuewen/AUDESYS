/**
 * FBD Palette Contribution — registers the FBD tool palette widget in the
 * Theia frontend application shell (left panel).
 *
 * This contribution:
 * 1. Creates the FbdPaletteWidget on startup
 * 2. Places it in the left panel area
 * 3. Binds the FbdToolState as a singleton for dependency injection
 */

import { injectable, inject } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution, FrontendApplication } from '@theia/core/lib/browser';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { FbdToolState } from './fbd-tool-state';
import { FbdPaletteWidget } from './fbd-palette-widget';

export const FBD_PALETTE_TOGGLE_COMMAND = {
    id: 'audesys.fbd.togglePalette',
    label: 'FBD: Toggle Tool Palette',
};

/**
 * Contribution that adds the FBD tool palette to the left panel at startup.
 */
@injectable()
export class FbdPaletteContribution implements FrontendApplicationContribution {

    constructor(
        @inject(ApplicationShell) private readonly shell: ApplicationShell,
        @inject(FbdToolState) private readonly toolState: FbdToolState,
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
     * Fallback: also open on start in case initializeLayout doesn't fire
     * (e.g. with a restored layout that doesn't include our widget).
     * The addWidget call is idempotent if the widget already exists.
     */
    async onStart(app: FrontendApplication): Promise<void> {
        // ponytail: addWidget is idempotent per shell id; safe to call twice
        await this.openPalette();
    }

    private async openPalette(): Promise<void> {
        const widget = new FbdPaletteWidget(this.toolState);
        await this.shell.addWidget(widget, {
            area: 'left',
            rank: 210, // ponytail: after LD palette (~200), before outline (~300)
        });
    }
}
