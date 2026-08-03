/**
 * LD Property View Frontend Module — inversify ContainerModule for DI bindings.
 *
 * Registers:
 * - LdPropertyState (singleton, shared across property view + future consumers)
 * - LdPropertyContribution (FrontendApplicationContribution)
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { LdPropertyState } from './ld-property-state';
import { LdPropertyContribution } from './ld-property-contribution';

export default new ContainerModule((bind) => {
    // PropertyState: singleton so property view and canvas share selection state
    bind(LdPropertyState).toSelf().inSingletonScope();

    // Property contribution: adds widget to bottom panel on startup
    bind(FrontendApplicationContribution).to(LdPropertyContribution);
});
