/**
 * LD Palette Contribution — registers the LD tool palette widget in the
 * Theia frontend application shell (left panel).
 *
 * This contribution:
 * 1. Creates the LdPaletteWidget on startup
 * 2. Places it in the left panel area
 * 3. Binds the LdToolState as a singleton for dependency injection
 */
import { FrontendApplicationContribution, FrontendApplication } from '@theia/core/lib/browser';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { LdToolState } from './ld-tool-state';
export declare const LD_PALETTE_TOGGLE_COMMAND: {
    id: string;
    label: string;
};
/**
 * Contribution that adds the LD tool palette to the left panel at startup.
 */
export declare class LdPaletteContribution implements FrontendApplicationContribution {
    private readonly shell;
    private readonly toolState;
    constructor(shell: ApplicationShell, toolState: LdToolState);
    /**
     * Called after the application shell is attached and when there is no
     * previous layout state to restore (initializeLayout).
     *
     * This ensures the palette appears on first launch but respects
     * saved layouts on subsequent launches.
     */
    initializeLayout(app: FrontendApplication): Promise<void>;
    /**
     * Fallback: also open on start in case initializeLayout doesn't fire
     * (e.g. with a restored layout that doesn't include our widget).
     * The addWidget call is idempotent if the widget already exists.
     */
    onStart(app: FrontendApplication): Promise<void>;
    private openPalette;
}
//# sourceMappingURL=ld-palette-contribution.d.ts.map