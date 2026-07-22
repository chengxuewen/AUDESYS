/**
 * IL Editor Frontend Module
 *
 * Registers:
 *   1. FrontendApplicationContribution — hooks into Theia startup to register
 *      the IL language, Monarch tokenizer, and completion provider with Monaco.
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { ILMonacoContribution } from './il-contribution';

export default new ContainerModule((bind) => {
    bind(FrontendApplicationContribution).to(ILMonacoContribution).inSingletonScope();
});
