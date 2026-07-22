import { AbstractViewContribution } from '@theia/core/lib/browser';
import type { FrontendApplication } from '@theia/core/lib/browser';
import { SignalBrowserWidget } from './signal-browser-widget';
/**
 * Registers the Signal Browser panel in the left sidebar.
 *
 * Uses Theia's view contribution pattern — implements WidgetFactory
 * so the widget can be opened/restored. Opens into the left panel
 * at rank 300, and auto-opens on application start.
 */
export declare class SignalBrowserContribution extends AbstractViewContribution<SignalBrowserWidget> {
    /** WidgetFactory.id — required by the WidgetFactory interface. */
    readonly id = "audesys.signal-browser";
    constructor();
    /**
     * Create a new widget instance. Called by Theia's widget manager
     * when the view is opened or restored from layout persistence.
     */
    createWidget(): SignalBrowserWidget;
    /**
     * Open the widget on application start so it's always visible.
     */
    onStart(_app: FrontendApplication): Promise<void>;
}
//# sourceMappingURL=signal-browser-contribution.d.ts.map