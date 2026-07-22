import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { GCodeLanguageContribution } from './gcode-frontend-module';

export default new ContainerModule((bind) => {
    bind(FrontendApplicationContribution).to(GCodeLanguageContribution);
});
