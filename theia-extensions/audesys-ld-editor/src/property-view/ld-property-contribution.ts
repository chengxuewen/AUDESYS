/**
 * LD Property Contribution — registers the LD property view widget
 * in the Theia frontend application shell (bottom panel).
 *
 * This contribution:
 * 1. Creates the LdPropertyWidget on startup
 * 2. Places it in the bottom panel area
 * 3. Binds the LdPropertyState as a singleton for dependency injection
 */

import { injectable, inject } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution, FrontendApplication } from '@theia/core/lib/browser';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { LdPropertyState } from './ld-property-state';
import { LdPropertyWidget } from './ld-property-widget';

export const LD_PROPERTY_TOGGLE_COMMAND = {
    id: 'audesys.ld.toggleProperty',
    label: 'LD: Toggle Property View',
};

/**
 * Contribution that adds the LD property view to the bottom panel at startup.
 */
@injectable()
export class LdPropertyContribution implements FrontendApplicationContribution {

    constructor(
        @inject(ApplicationShell) private readonly shell: ApplicationShell,
        @inject(LdPropertyState) private readonly propertyState: LdPropertyState,
    ) {}

    /**
     * Called after the application shell is attached and when there is no
     * previous layout state to restore (initializeLayout).
     */
    async initializeLayout(_app: FrontendApplication): Promise<void> {
        await this.openPropertyView();
    }

    /**
     * Fallback: also open on start in case initializeLayout doesn't fire
     * (e.g. with a restored layout that doesn't include our widget).
     * The addWidget call is idempotent if the widget already exists.
     */
    async onStart(_app: FrontendApplication): Promise<void> {
        // ponytail: addWidget is idempotent per shell id; safe to call twice
        await this.openPropertyView();
    }

    private async openPropertyView(): Promise<void> {
        const widget = new LdPropertyWidget(this.propertyState);
        await this.shell.addWidget(widget, {
            area: 'bottom',
            rank: 600, // ponytail: after problems (~500), before terminal (~700)
        });
    }
}
