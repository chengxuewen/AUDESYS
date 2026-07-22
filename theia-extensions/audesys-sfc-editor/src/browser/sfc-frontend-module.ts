/**
 * SFC Editor Frontend Module
 *
 * Registers:
 *   1. FrontendApplicationContribution — hooks into Theia startup to register
 *      the SFC language, Monarch tokenizer with Monaco.
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { SfcMonacoContribution } from './sfc-contribution';

export default new ContainerModule((bind) => {
    bind(FrontendApplicationContribution).to(SfcMonacoContribution).inSingletonScope();
});
