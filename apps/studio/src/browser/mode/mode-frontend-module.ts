// Inversify ContainerModule that binds the mode system into Theia's DI container

import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { CommandContribution } from '@theia/core/lib/common';
import { AudesysModeManager } from './audesys-mode-manager';
import { ModeStatusBarItem } from './mode-status-bar-item';
import { ModeContribution } from './mode-contribution';

export default new ContainerModule((bind) => {
    bind(AudesysModeManager).toSelf().inSingletonScope();
    bind(ModeStatusBarItem).toSelf().inSingletonScope();
    bind(ModeContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(ModeContribution);
    bind(CommandContribution).toService(ModeContribution);
});
