/**
 * FBD GLSP Server Entry Point — standalone launcher for FBD GLSP server.
 *
 * Launches a GLSP server that handles FBD (Function Block Diagram) operations.
 * Uses the same pattern as LD server but with FBD-specific diagram module.
 *
 * Usage: node fbd-server-index.js [--port PORT] [--host HOST]
 */

// Standalone launcher — GLSP 2.7.0 API
import { createAppModule, createSocketCliParser, SocketServerLauncher } from '@eclipse-glsp/server/node';
import { ServerModule } from '@eclipse-glsp/server';
import { Container } from 'inversify';
import { FbdDiagramModule } from './fbd-diagram-module';

export async function launch(argv: string[] = process.argv): Promise<void> {
    const options = createSocketCliParser().parse(argv);
    const appContainer = new Container();
    appContainer.load(createAppModule(options));
    const launcher = appContainer.resolve(SocketServerLauncher);
    const serverModule = new ServerModule().configureDiagramModule(new FbdDiagramModule());
    launcher.configure(serverModule);
    launcher.start({ port: options.port, host: options.host });
}

if (require.main === module) {
    launch().catch(error => console.error('FBD GLSP server failed:', error));
}
