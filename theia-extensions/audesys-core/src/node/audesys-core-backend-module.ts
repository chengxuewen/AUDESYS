import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, JsonRpcConnectionHandler } from '@theia/core/lib/common';
import { SignalBridgeServer } from './signal-bridge-service';
import { SignalBridgeServicePath } from '../common/signal-bridge-protocol';

export default new ContainerModule((bind) => {
    bind(SignalBridgeServer).toSelf().inSingletonScope();

    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler(SignalBridgeServicePath, () =>
            ctx.container.get(SignalBridgeServer)
        )
    ).inSingletonScope();
});
