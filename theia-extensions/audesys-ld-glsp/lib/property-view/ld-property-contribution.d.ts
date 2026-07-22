/**
 * LD Property Contribution — registers the LD property view widget
 * in the Theia frontend application shell (bottom panel).
 *
 * This contribution:
 * 1. Creates the LdPropertyWidget on startup
 * 2. Places it in the bottom panel area
 * 3. Binds the LdPropertyState as a singleton for dependency injection
 */
import { FrontendApplicationContribution, FrontendApplication } from '@theia/core/lib/browser';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { LdPropertyState } from './ld-property-state';
export declare const LD_PROPERTY_TOGGLE_COMMAND: {
    id: string;
    label: string;
};
/**
 * Contribution that adds the LD property view to the bottom panel at startup.
 */
export declare class LdPropertyContribution implements FrontendApplicationContribution {
    private readonly shell;
    private readonly propertyState;
    constructor(shell: ApplicationShell, propertyState: LdPropertyState);
    /**
     * Called after the application shell is attached and when there is no
     * previous layout state to restore (initializeLayout).
     */
    initializeLayout(_app: FrontendApplication): Promise<void>;
    /**
     * Fallback: also open on start in case initializeLayout doesn't fire
     * (e.g. with a restored layout that doesn't include our widget).
     * The addWidget call is idempotent if the widget already exists.
     */
    onStart(_app: FrontendApplication): Promise<void>;
    private openPropertyView;
}
//# sourceMappingURL=ld-property-contribution.d.ts.map