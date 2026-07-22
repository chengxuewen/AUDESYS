/**
 * FBD Palette Contribution — registers the FBD tool palette widget in the
 * Theia frontend application shell (left panel).
 *
 * This contribution:
 * 1. Creates the FbdPaletteWidget on startup
 * 2. Places it in the left panel area
 * 3. Binds the FbdToolState as a singleton for dependency injection
 */
import { FrontendApplicationContribution, FrontendApplication } from '@theia/core/lib/browser';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { FbdToolState } from './fbd-tool-state';
export declare const FBD_PALETTE_TOGGLE_COMMAND: {
    id: string;
    label: string;
};
/**
 * Contribution that adds the FBD tool palette to the left panel at startup.
 */
export declare class FbdPaletteContribution implements FrontendApplicationContribution {
    private readonly shell;
    private readonly toolState;
    constructor(shell: ApplicationShell, toolState: FbdToolState);
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
//# sourceMappingURL=fbd-palette-contribution.d.ts.map