"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("@theia/core/shared/inversify");
const node_1 = require("@theia/core/lib/node");
const audesys_backend_service_1 = require("./audesys-backend-service");
exports.default = new inversify_1.ContainerModule((bind) => {
    bind(audesys_backend_service_1.AudesysBackendService).toSelf().inSingletonScope();
    bind(node_1.BackendApplicationContribution).toService(audesys_backend_service_1.AudesysBackendService);
});
//# sourceMappingURL=audesys-backend-module.js.map