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
     * Fallback: also open on start in case initializeLayout doesn't fire
     * (e.g. with a restored layout that doesn't include our widget).
     * The addWidget call is idempotent if the widget already exists.
     */
    async onStart(app: FrontendApplication): Promise<void> {
        // ponytail: addWidget is idempotent per shell id; safe to call twice
        await this.openPalette();
    }

    private async openPalette(): Promise<void> {
        const widget = new LdPaletteWidget(this.toolState);
        await this.shell.addWidget(widget, {
            area: 'left',
            rank: 200, // ponytail: after file explorer (~100), before outline (~300)
        });
    }
}
