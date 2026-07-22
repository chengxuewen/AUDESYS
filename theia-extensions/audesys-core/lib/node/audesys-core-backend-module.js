"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("@theia/core/shared/inversify");
const common_1 = require("@theia/core/lib/common");
const signal_bridge_service_1 = require("./signal-bridge-service");
const signal_bridge_protocol_1 = require("../common/signal-bridge-protocol");
exports.default = new inversify_1.ContainerModule((bind) => {
    bind(signal_bridge_service_1.SignalBridgeServer).toSelf().inSingletonScope();
    bind(common_1.ConnectionHandler).toDynamicValue(ctx => new common_1.JsonRpcConnectionHandler(signal_bridge_protocol_1.SignalBridgeServicePath, () => ctx.container.get(signal_bridge_service_1.SignalBridgeServer))).inSingletonScope();
});
//# sourceMappingURL=audesys-core-backend-module.js.map