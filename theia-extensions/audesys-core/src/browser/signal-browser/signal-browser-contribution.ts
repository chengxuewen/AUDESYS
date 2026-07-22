import { injectable } from '@theia/core/shared/inversify';
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
@injectable()
export class SignalBrowserContribution extends AbstractViewContribution<SignalBrowserWidget> {
    /** WidgetFactory.id — required by the WidgetFactory interface. */
    readonly id = SignalBrowserWidget.ID;

    constructor() {
        super({
            widgetId: SignalBrowserWidget.ID,
            widgetName: SignalBrowserWidget.LABEL,
            defaultWidgetOptions: {
                area: 'left',
                rank: 300,
            },
        });
    }

    /**
     * Create a new widget instance. Called by Theia's widget manager
     * when the view is opened or restored from layout persistence.
     */
    createWidget(): SignalBrowserWidget {
        return new SignalBrowserWidget();
    }

    /**
     * Open the widget on application start so it's always visible.
     */
    async onStart(_app: FrontendApplication): Promise<void> {
        // ponytail: shell may not be ready during early init; catch prevents crash
        try {
            this.openView({ reveal: true });
        } catch {
            /* widget will open when user clicks Signal Browser in sidebar */
        }
}

}