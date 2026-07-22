/**
 * LD Palette Frontend Module — inversify ContainerModule for DI bindings.
 *
 * Registers:
 * - LdToolState (singleton, shared across palette + future canvas consumers)
 * - LdPaletteContribution (FrontendApplicationContribution)
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { LdToolState } from './ld-tool-state';
import { LdPaletteContribution } from './ld-palette-contribution';

export default new ContainerModule((bind) => {
    // ToolState: singleton so palette and canvas share selection state
    bind(LdToolState).toSelf().inSingletonScope();

    // Palette contribution: adds widget to left panel on startup
    bind(FrontendApplicationContribution).to(LdPaletteContribution);
});
