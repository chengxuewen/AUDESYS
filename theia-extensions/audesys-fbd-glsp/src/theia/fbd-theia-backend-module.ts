/**
 * FBD Theia Backend Module — GLSP server contribution for Theia backend.
 *
 * Registers the FBD GLSP server as a GLSPSocketServerContribution.
 * Theia backend launches the server process and forwards connections.
 */
import { GLSPServerContribution } from '@eclipse-glsp/theia-integration/lib/node';
import { ContainerModule } from '@theia/core/shared/inversify';
import { FbdServerContribution } from './fbd-server-contribution';

export default new ContainerModule(bind => {
    bind(FbdServerContribution).toSelf().inSingletonScope();
    bind(GLSPServerContribution).to(FbdServerContribution).inSingletonScope();
});
