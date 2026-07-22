/**
 * ST Editor Frontend Module
 *
 * Registers the Structured Text language contribution
 * via Theia's DI container.
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { StLanguageContribution } from './st-language-contribution';

export default new ContainerModule((bind) => {
    bind(FrontendApplicationContribution).to(StLanguageContribution);
});
