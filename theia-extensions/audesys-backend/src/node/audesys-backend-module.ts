import { ContainerModule } from '@theia/core/shared/inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node';
import { AudesysBackendService } from './audesys-backend-service';

export default new ContainerModule((bind) => {
    bind(AudesysBackendService).toSelf().inSingletonScope();
    bind(BackendApplicationContribution).toService(AudesysBackendService);
});
