import { injectable } from '@theia/core/shared/inversify';
import { AbstractViewContribution } from '@theia/core/lib/browser';
import type { FrontendApplication } from '@theia/core/lib/browser';
import { ScopeViewWidget } from './scope-panel-widget';

/**
 * Registers the Scope View panel in the bottom panel area.
 *
 * Uses Theia's view contribution pattern. The widget opens in the
 * bottom panel at rank 500 and auto-opens on application start.
 */
@injectable()
export class ScopeViewContribution extends AbstractViewContribution<ScopeViewWidget> {
    /** WidgetFactory.id — required by the WidgetFactory interface. */
    readonly id = ScopeViewWidget.ID;

    constructor() {
        super({
            widgetId: ScopeViewWidget.ID,
            widgetName: ScopeViewWidget.LABEL,
            defaultWidgetOptions: {
                area: 'bottom',
                rank: 500,
            },
        });
    }

    /** Create a new widget instance. */
    createWidget(): ScopeViewWidget {
        return new ScopeViewWidget();
    }

    /** Auto-open the widget on application start. */
    async onStart(_app: FrontendApplication): Promise<void> {
        // ponytail: shell may not be ready during early init; catch prevents crash
        try {
            this.openView({ reveal: true });
        } catch {
            /* widget will open when user clicks Scope View in sidebar */
        }
}

}