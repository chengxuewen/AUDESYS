"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LdServerContribution = void 0;
/**
 * LD Server Contribution — launches the LD GLSP server as a socket process.
 *
 * The GLSP server runs as a separate Node.js process managed by Theia.
 * Uses @eclipse-glsp/theia-integration's GLSPSocketServerContribution.
 */
const node_1 = require("@eclipse-glsp/theia-integration/lib/node");
const inversify_1 = require("inversify");
const ld_language_1 = require("./ld-language");
const DEFAULT_PORT = 0;
const PORT_ARG_KEY = 'LD_GLSP';
let LdServerContribution = class LdServerContribution extends node_1.GLSPSocketServerContribution {
    constructor() {
        super(...arguments);
        this.id = ld_language_1.LdDiagramLanguage.contributionId;
    }
    createContributionOptions() {
        return {
            executable: require.resolve('../../src/server/index'),
            socketConnectionOptions: {
                port: getPort(PORT_ARG_KEY, DEFAULT_PORT),
                host: '127.0.0.1'
            },
        };
    }
};
exports.LdServerContribution = LdServerContribution;
exports.LdServerContribution = LdServerContribution = __decorate([
    (0, inversify_1.injectable)()
], LdServerContribution);
function getPort(argsKey, defaultPort) {
    const key = `--${argsKey.replace('--', '').replace('=', '')}=`;
    const args = process.argv.filter(a => a.startsWith(key));
    if (args.length > 0) {
        return Number.parseInt(args[0].substring(key.length), 10);
    }
    return defaultPort ?? NaN;
}
//# sourceMappingURL=ld-server-contribution.js.map