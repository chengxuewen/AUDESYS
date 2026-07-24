import { injectable } from '@theia/core/shared/inversify';
import type { FrontendApplicationContribution, FrontendApplication } from '@theia/core/lib/browser';

/**
 * Forces the browser tab title to always show "AUDESYS Studio"
 * regardless of which workspace folder is open.
 */
@injectable()
export class WindowTitleContribution implements FrontendApplicationContribution {
    async onStart(_app: FrontendApplication): Promise<void> {
        document.title = 'AUDESYS Studio';

        // Also watch for title changes from Theia and override them
        const observer = new MutationObserver(() => {
            if (document.title !== 'AUDESYS Studio') {
                document.title = 'AUDESYS Studio';
            }
        });
        observer.observe(document.querySelector('title')!, {
            childList: true,
            characterData: true,
            subtree: true,
        });
    }
}
