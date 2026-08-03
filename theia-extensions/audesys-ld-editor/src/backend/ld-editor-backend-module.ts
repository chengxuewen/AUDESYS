/**
 * LD Editor Backend Module — compile, load, save via napi-rs.
 *
 * D110: 无 GLSP 服务器，Theia 后端直接调用 napi-rs bridge。
 */
import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, JsonRpcConnectionHandler } from '@theia/core/lib/common';

export default new ContainerModule((bind) => {
    // Phase 1: bind compile service, file io handlers
    // Placeholder — implementation in Phase 1
});