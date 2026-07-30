/**
 * LD Editor OpenHandler — ensures .ld files are recognized by Theia.
 *
 * Priority 1000: above Monaco text editor (100), below GLSPDiagramManager (1001).
 * If GLSP framework works, this handler is never selected.
 * If GLSP fails (known inversify 6.2.2 issue), this prevents Monaco text fallback.
 */
import { injectable } from '@theia/core/shared/inversify';
import { OpenHandler } from '@theia/core/lib/browser/opener-service';
import { URI } from '@theia/core/lib/common/uri';

@injectable()
export class LdEditorOpenHandler implements OpenHandler {
    readonly id = 'audesys-ld-opener';
    readonly label = 'LD Ladder Diagram Editor';

    canHandle(uri: URI): number {
        return uri.path.ext === '.ld' ? 1000 : 0;
    }

    async open(_uri: URI): Promise<undefined> {
        // GLSPDiagramManager handles actual widget creation.
        // This handler is a routing safety net.
        return undefined;
    }
}