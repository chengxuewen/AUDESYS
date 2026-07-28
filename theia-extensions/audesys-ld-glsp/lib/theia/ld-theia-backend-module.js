"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * LD Theia Backend Module — GLSP server contribution for Theia backend.
 *
 * Registers the LD GLSP server as a GLSPSocketServerContribution.
 * Theia backend launches the server process and forwards connections.
 */
const node_1 = require("@eclipse-glsp/theia-integration/lib/node");
const inversify_1 = require("@theia/core/shared/inversify");
const ld_server_contribution_1 = require("./ld-server-contribution");
exports.default = new inversify_1.ContainerModule(bind => {
    bind(ld_server_contribution_1.LdServerContribution).toSelf().inSingletonScope();
    bind(node_1.GLSPServerContribution).toService(ld_server_contribution_1.LdServerContribution);
});
//# sourceMappingURL=ld-theia-backend-module.js.map