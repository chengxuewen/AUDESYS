/**
 * FBD Palette Frontend Module — inversify ContainerModule for DI bindings.
 *
 * Registers:
 * - FbdToolState (singleton, shared across palette + future canvas consumers)
 * - FbdPaletteContribution (FrontendApplicationContribution)
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { FbdToolState } from './fbd-tool-state';
import { FbdPaletteContribution } from './fbd-palette-contribution';

export default new ContainerModule((bind) => {
    // ToolState: singleton so palette and canvas share selection state
    bind(FbdToolState).toSelf().inSingletonScope();

    // Palette contribution: adds widget to left panel on startup
    bind(FrontendApplicationContribution).to(FbdPaletteContribution);
});
