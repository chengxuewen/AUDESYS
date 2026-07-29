/**
 * LD Server Contribution — launches the LD GLSP server as a socket process.
 *
 * The GLSP server runs as a separate Node.js process managed by Theia.
 * Uses @eclipse-glsp/theia-integration's GLSPSocketServerContribution.
 */
import { GLSPSocketServerContribution, GLSPSocketServerContributionOptions } from '@eclipse-glsp/theia-integration/lib/node';
import { injectable } from 'inversify';
import { LdDiagramLanguage } from './ld-language';

const DEFAULT_PORT = 0;
const PORT_ARG_KEY = 'LD_GLSP';

@injectable()
export class LdServerContribution extends GLSPSocketServerContribution {
    readonly id = LdDiagramLanguage.contributionId;

    createContributionOptions(): Partial<GLSPSocketServerContributionOptions> {
        return {
            executable: require.resolve('audesys-ld-glsp/lib/server/index'),
            socketConnectionOptions: {
                port: getPort(PORT_ARG_KEY, DEFAULT_PORT),
                host: '127.0.0.1'
            },
        };
    }
}

function getPort(argsKey: string, defaultPort?: number): number {
    const key = `--${argsKey.replace('--', '').replace('=', '')}=`;
    const args = process.argv.filter(a => a.startsWith(key));
    if (args.length > 0) {
        return Number.parseInt(args[0].substring(key.length), 10);
    }
    return defaultPort ?? NaN;
}
