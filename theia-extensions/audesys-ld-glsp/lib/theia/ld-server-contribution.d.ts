/**
 * LD Server Contribution — launches the LD GLSP server as a socket process.
 *
 * The GLSP server runs as a separate Node.js process managed by Theia.
 * Uses @eclipse-glsp/theia-integration's GLSPSocketServerContribution.
 */
import { GLSPSocketServerContribution, GLSPSocketServerContributionOptions } from '@eclipse-glsp/theia-integration/lib/node';
export declare class LdServerContribution extends GLSPSocketServerContribution {
    readonly id: string;
    createContributionOptions(): Partial<GLSPSocketServerContributionOptions>;
}
//# sourceMappingURL=ld-server-contribution.d.ts.map