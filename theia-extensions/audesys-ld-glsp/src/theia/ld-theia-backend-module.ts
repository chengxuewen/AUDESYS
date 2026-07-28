/**
 * LD Theia Backend Module — GLSP server contribution for Theia backend.
 *
 * Registers the LD GLSP server as a GLSPSocketServerContribution.
 * Theia backend launches the server process and forwards connections.
 */
import { GLSPServerContribution } from '@eclipse-glsp/theia-integration/lib/node';
import { ContainerModule } from '@theia/core/shared/inversify';
import { LdServerContribution } from './ld-server-contribution';

export default new ContainerModule(bind => {
    bind(LdServerContribution).toSelf().inSingletonScope();
    bind(GLSPServerContribution).toService(LdServerContribution);
});
